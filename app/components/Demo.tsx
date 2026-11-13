'use client'

import axios from 'axios';
import { useState, useEffect, useRef } from 'react';

import styles from './demo.module.css';
import LoadingCard from './LoadingCard';
import type { LoadingMessage } from './LoadingCard';
import PageResult from './PageResult';
import type { ReadPage } from './PageResult';
import PdfSummary from './PdfSummary';
import SamplePageForm from './SamplePageForm';
import SaveText from './SaveText';
import { shrinkForUpload } from './shrink';
import { loadChecks, pageKey, saveChecks } from './savedChecks';
import UploadForm from './UploadForm';
import { boxKey, unresolvedFlags } from './corrections';
import { flaggedBoxes } from './pagecompare';
import FlaggedWords from './FlaggedWords';
import type {
	Confirmed, Correction, Corrections, EditedBox, ErrorResponse, Page, PageBox, SamplePage,
} from './types';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND

// One page read: the backend's /upload/multiple or /random?source=page
// response and the Abkai expected ('' if unknown), or why it couldn't be
// read. title heads it, for a PDF's pages.
type Reading = {
	title?: string;
	result?: ReadPage;
	expected: string;
	error?: string;
	// The image sent to be read (an upload, perhaps shrunk, or a PDF's page),
	// which is sent again with the page's angle to read edited boxes, so the
	// server has the page exactly as it was. A sample page has none: it's
	// sent by name.
	sent?: File;
	// The user's words for some of its boxes, which outlast reading it again
	// in edited boxes, as the boxes they're for keep their place
	corrections?: Corrections;
	// The boxes whose flagged reading the user marked as right, which last
	// as the corrections do
	confirmed?: Confirmed;
	// Where those are kept in this browser: from the page as first read, so
	// it stays the same when it's read again in edited boxes
	storageKey?: string;
};

// A page just read, with any checks kept for it from before
function newReading(reading: Omit<Reading, 'storageKey'>): Reading {
	if (!reading.result) return reading;
	const storageKey = pageKey(reading.result.image);
	return { ...reading, ...loadChecks(storageKey), storageKey };
}

// The data-box-id of box index of readings[reading]'s page
const boxId = (reading: number, box: number) => `reading-${reading}-box-${box}`;

// Opens a box close up, as clicking it does, with it scrolled into view and
// focused behind the dialog, so the page is there when it closes. In the
// editor, where the page's boxes aren't drawn, its word in the text stands
// in.
function openBox(id: string) {
	const element = document.querySelector<HTMLElement | SVGElement>(`[data-box-id="${id}"]`);
	if (!element) return;
	element.scrollIntoView({ block: 'center' });
	element.focus({ preventScroll: true });
	element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

// The element id of a PDF's page number (from 1), for links to it
const pdfPageId = (page: number) => `pdf-page-${page}`;

// A request that may succeed if tried again: the server busy (Heroku cuts
// off a request after 30 seconds with a 503, and its own errors carry no
// CORS header, so the browser sees no response at all), or ours timing out
const busy = (error: unknown) => axios.isAxiosError(error)
	&& (!error.response || [502, 503, 504].includes(error.response.status));

// The server's {"error": ...} for a failed request, or why it may have
// failed if the server was busy, or fallback
const errorMessage = (error: unknown, fallback: string) => (
	axios.isAxiosError<ErrorResponse>(error) && error.response?.data?.error
) || (busy(error)
	? 'The server is too busy right now, or couldn\'t be reached. Try again in a minute.'
	: fallback);

// How long to wait before each try again, so at most three tries
const RETRY_DELAYS = [3000, 8000];

// What a request does while it's tried again: whether it's still wanted (a
// read that's been stopped or overtaken isn't), and onBusy(true) while it's
// waiting to try again, then onBusy(false)
type Retrying = { wanted: () => boolean; onBusy: (busy: boolean) => void };

// Sends a request, trying again after a pause if the server was busy
async function withRetries<T>(send: () => Promise<T>, { wanted, onBusy }: Retrying) {
	try {
		for (let attempt = 0; ; attempt++) {
			try {
				return await send();
			} catch (error) {
				if (attempt >= RETRY_DELAYS.length || !busy(error) || !wanted()) throw error;
				onBusy(true);
				await new Promise((resolve) => { setTimeout(resolve, RETRY_DELAYS[attempt]); });
				if (!wanted()) throw error;
			}
		}
	} finally {
		onBusy(false);
	}
}

// Leaves the boxes' own images out of the server's responses: they're most
// of a response, and the close-up cuts each box from the page instead.
// And gives up on a request after a minute, to try it again: Heroku has
// given up on it by then.
const REQUEST = { params: { crops: 'false' }, timeout: 60_000 };

// Sends an image of a page to be read, shrunk first if it's big, and gives
// the image sent with the reading, to send again to read edited boxes
const postPage = async (file: File, retrying: Retrying) => {
	const sent = await shrinkForUpload(file);
	const body = new FormData();
	body.append('image', sent);
	const { data } = await withRetries(
		() => axios.post<Page>(`${BACKEND}/upload/multiple`, body, REQUEST), retrying);
	return { data, sent };
};

// Reads the user's page (or a PDF's pages), or loads a sample one, and
// shows how each was read
export default function Demo({ backendAwake = false }: {
	backendAwake?: boolean;
}) {
	// The pages on show: one, or a PDF's, in order, as they're read
	const [readings, setReadings] = useState<Reading[]>([]);
	// false, or the LoadingCard message to show
	const [loading, setLoading] = useState<LoadingMessage | false>(false);
	// While a PDF is read: the page being read, out of how many
	const [progress, setProgress] = useState<{ page: number; pages: number }>();
	// How many pages the PDF on show has, if the readings are a PDF's
	const [pdfPages, setPdfPages] = useState<number>();
	const [error, setError] = useState<string>();
	// True while a page read is waiting to be tried again, the server busy
	const [retrying, setRetrying] = useState(false);
	// The reading whose edited boxes are waiting to be read again, likewise
	const [rereadRetrying, setRereadRetrying] = useState<number>();
	// The sample pages' names, from GET /pages
	const [pageNames, setPageNames] = useState<string[]>([]);
	// What a saved .txt of the readings is named after: the upload, the PDF
	// or the sample page
	const [saveName, setSaveName] = useState('reading');
	// Bumped by every new read (or new file), so a PDF being read stops
	// before its next page
	const run = useRef(0);
	// True while a PDF's pages are being read
	const readingPdf = useRef(false);
	// The last page read sent. Each waits for the one before it, even one
	// whose result is no longer wanted (after Stop), so the server only ever
	// reads one page of ours at a time.
	const lastSend = useRef<Promise<unknown>>(Promise.resolve());
	const inTurn = <T,>(send: () => Promise<T>): Promise<T> => {
		const next = lastSend.current.catch(() => {}).then(send);
		lastSend.current = next;
		return next;
	};

	// Runs a backend request for one page: shows loadingMessage meanwhile,
	// then the page, or the server's error (or fallback)
	const request = <T extends Page,>(
		loadingMessage: LoadingMessage,
		send: (retrying: Retrying) => Promise<{ data: T; sent?: File }>,
		fallback: string,
		expected: (result: T) => string,
	) => {
		const current = ++run.current;
		readingPdf.current = false;
		setProgress(undefined);
		setLoading(loadingMessage);
		setPdfPages(undefined);
		setError(undefined);
		inTurn(() => send({ wanted: () => current === run.current, onBusy: setRetrying }))
			.then(({ data, sent }) => {
				if (current !== run.current) return;
				setReadings([newReading({ result: data, expected: expected(data), sent })]);
			})
			.catch((error) => {
				if (current === run.current) setError(errorMessage(error, fallback));
			})
			.finally(() => {
				if (current === run.current) setLoading(false);
			});
	};

	// The server ignores a label for a page, so the comparison with the
	// expected Abkai is made here
	const readPage = (file: File, expected: string) => {
		setSaveName(file.name.replace(/\.[^.]+$/, '') || 'reading');
		request('readingPage', (retrying) => postPage(file, retrying), 'Couldn\'t read the page.',
			() => expected);
	};

	// Reads every page of a PDF in turn, each sent once the one before it is
	// back, showing each as it comes. A page that can't be rendered or read
	// shows why, and the rest are still read.
	const readAll = async (
		pages: number,
		render: (page: number) => Promise<File>,
		expected: (page: number) => string,
	) => {
		const current = ++run.current;
		readingPdf.current = true;
		setSaveName('reading');
		setError(undefined);
		setReadings([]);
		setPdfPages(pages);
		setLoading('readingPdf');
		for (let page = 1; page <= pages; page++) {
			setProgress({ page, pages });
			const title = `Page ${page}`;
			let reading: Reading;
			try {
				const file = await render(page);
				if (current !== run.current) return;
				// Named "<the PDF>, page <n>.jpg"
				if (page === 1) setSaveName(file.name.replace(/, page \d+\.\w+$/, ''));
				const { data, sent } = await inTurn(() => postPage(file,
					{ wanted: () => current === run.current, onBusy: setRetrying }));
				reading = newReading({ title, result: data, expected: expected(page), sent });
			} catch (error) {
				reading = {
					title, expected: expected(page),
					error: errorMessage(error, 'Couldn\'t read this page.'),
				};
			}
			if (current !== run.current) return;
			setReadings((previous) => [...previous, reading]);
		}
		readingPdf.current = false;
		setProgress(undefined);
		setLoading(false);
	};

	// Stops a PDF being read after the page in flight
	const stop = () => {
		run.current++;
		readingPdf.current = false;
		setProgress(undefined);
		setLoading(false);
	};

	// Reads readings[index]'s page again in the boxes the user edited. It
	// keeps its title, expected text, angle and, for a sample page, its
	// transcription and credit, but not the server's score of the old
	// reading. Rejects with why it couldn't.
	// The page goes as it was first sent, with the angle it was turned by, so
	// the server has it to the pixel: the image sent, or a sample page's name.
	// (Not the response's image, a JPEG for showing, which reads a little
	// differently.)
	const reread = (index: number, boxes: EditedBox[]) => {
		const current = run.current;
		const { result: old, sent } = readings[index];
		const url = `${BACKEND}/upload/multiple/boxes`;
		const send = () => {
			if (sent) {
				const body = new FormData();
				body.append('image', sent);
				body.append('angle', String(old!.angle));
				body.append('boxes', JSON.stringify(boxes));
				return axios.post<Page>(url, body, REQUEST);
			}
			if (old && 'name' in old) {
				return axios.post<Page>(url, { name: old.name, angle: old.angle, boxes }, REQUEST);
			}
			// Nothing else to send it by: the page as shown, taken as it is
			return axios.post<Page>(url, { image: old!.image, boxes }, REQUEST);
		};
		return inTurn(() => withRetries(send, {
			wanted: () => current === run.current,
			onBusy: (waiting) => { setRereadRetrying(waiting ? index : undefined); },
		}))
			.then(({ data }) => {
				if (current !== run.current) return;
				const result: ReadPage = { ...old!, ...data };
				if ('score' in result) delete (result as Partial<SamplePage>).score;
				setReadings((previous) => previous.map((reading, i) => (
					i === index ? { ...reading, result } : reading)));
			})
			.catch((error) => {
				throw new Error(errorMessage(error, 'Couldn\'t read the boxes.'));
			});
	};

	// Puts the user's word for a box of readings[index]'s page in place of
	// the model's, or goes back to the model's for undefined
	const correct = (index: number, box: PageBox, correction?: Correction) => {
		setReadings((previous) => previous.map((reading, i) => {
			if (i !== index) return reading;
			const corrections = { ...reading.corrections };
			if (correction) corrections[boxKey(box)] = correction;
			else delete corrections[boxKey(box)];
			return { ...reading, corrections };
		}));
	};

	// Marks a flagged box's reading as right, or takes that back
	const confirm = (index: number, box: PageBox, yes: boolean) => {
		setReadings((previous) => previous.map((reading, i) => {
			if (i !== index) return reading;
			const confirmed = { ...reading.confirmed };
			if (yes) confirmed[boxKey(box)] = true;
			else delete confirmed[boxKey(box)];
			return { ...reading, confirmed };
		}));
	};

	// The flagged words still to check, on every page on show, in order
	const toCheck = readings.flatMap(({ result, expected, corrections, confirmed }, reading) => (
		result
			? unresolvedFlags(result, expected, corrections, confirmed)
				.map((box) => ({ reading, box }))
			: []));
	// Every flagged word on show, settled or not, in order, for Previous
	const flagged = readings.flatMap(({ result, expected }, reading) => (
		result
			? flaggedBoxes(result.boxes, expected)
				.map((isFlagged, box) => (isFlagged ? { reading, box } : undefined))
				.filter((word) => word !== undefined)
			: []));
	// The last one gone to, so Next goes on from it
	const [lastChecked, setLastChecked] = useState<{ reading: number; box: number }>();
	// True while the user is going through them with Next word: settling one
	// opens the next, until they close one without settling it
	const checking = useRef(false);
	// Opens the next word to check after the last one, round to the first,
	// leaving out the one gone to last if it's just been settled
	const nextToCheck = (settled = false) => {
		const left = settled && lastChecked
			? toCheck.filter(({ reading, box }) => (
				reading !== lastChecked.reading || box !== lastChecked.box))
			: toCheck;
		const next = left.find(({ reading, box }) => !lastChecked
			|| reading > lastChecked.reading
			|| (reading === lastChecked.reading && box > lastChecked.box)) ?? left[0];
		if (!next) {
			checking.current = false;
			return;
		}
		checking.current = true;
		setLastChecked(next);
		openBox(boxId(next.reading, next.box));
	};
	// Opens the flagged word before the last one gone to, settled or not,
	// round to the last, to look again at one just settled. Settling it
	// again opens the next to check, as from Next word.
	const previousFlagged = () => {
		const before = lastChecked
			? flagged.filter(({ reading, box }) => reading < lastChecked.reading
				|| (reading === lastChecked.reading && box < lastChecked.box))
			: [];
		const previous = before.at(-1) ?? flagged.at(-1);
		if (!previous) return;
		checking.current = true;
		setLastChecked(previous);
		openBox(boxId(previous.reading, previous.box));
	};
	const onBoxClosed = (ruled: boolean) => {
		if (!checking.current) return;
		if (!ruled) {
			checking.current = false;
			return;
		}
		// Once the settled word's close-up has closed. toCheck is from before
		// it was settled, but nothing else has changed, so leaving it out is
		// enough.
		setTimeout(() => { nextToCheck(true); });
	};

	// Loads the sample page with this name, or any one for ''
	const loadPage = (name = '') => {
		request('loadingPage',
			(retrying) => withRetries(() => axios.get<SamplePage>(`${BACKEND}/random`, {
				...REQUEST,
				params: { source: 'page', ...REQUEST.params, ...(name && { name }) },
			}), retrying),
			'Couldn\'t load a page.',
			(result) => {
				setSaveName(result.name);
				return result.transcription;
			});
	};

	// Without the list of pages, only a random one can be picked
	// Keeps each page's checks as they change
	useEffect(() => {
		for (const { storageKey, corrections, confirmed } of readings) {
			if (storageKey) saveChecks(storageKey, { corrections, confirmed });
		}
	}, [readings]);

	useEffect(() => {
		if (!backendAwake) return;
		axios.get<{ pages: string[] }>(`${BACKEND}/pages`)
			.then(({ data }) => { setPageNames(data.pages); })
			.catch(() => {});
	}, [backendAwake]);

	const busy = !backendAwake || Boolean(loading);

	return (
		<section className={styles.demo}>
			<h2>Read a page</h2>
			<div className={styles.form}>
				<UploadForm
					disabled={busy}
					onRead={readPage}
					onReadAll={readAll}
					onFileChange={() => { if (readingPdf.current) stop(); }}
					onError={setError}
					beside={(
						<SamplePageForm
							disabled={busy}
							names={pageNames}
							onLoad={loadPage}
						/>
					)}
				/>
				<LoadingCard
					loading={Boolean(loading) || !backendAwake}
					message={backendAwake && loading ? loading : 'wakingServer'}
					text={backendAwake && progress
						? `Reading page ${progress.page} of ${progress.pages}${retrying ? ': the server is busy, trying again…' : '...'}`
						: backendAwake && retrying
							? 'The server is busy. Trying again…'
							: undefined}
				>
					{progress && (
						<button type="button" className={styles.stop} onClick={stop}>
							Stop
						</button>
					)}
				</LoadingCard>
				{error && <p className={styles.error} role="alert">{error}</p>}
			</div>
			{pdfPages !== undefined && (
				<PdfSummary readings={readings} pages={pdfPages} pageId={pdfPageId} />
			)}
			<SaveText readings={readings} name={saveName} />
			{readings.map(({
				title, result, expected, error: problem, corrections, confirmed,
			}, index) => (
				result
					? (
						<PageResult
							key={index}
							page={result}
							expected={expected}
							title={title}
							id={pdfPages !== undefined ? pdfPageId(index + 1) : undefined}
							onReread={(boxes) => reread(index, boxes)}
							rereadNote={rereadRetrying === index
								? 'The server is busy. Trying again…' : undefined}
							corrections={corrections}
							onCorrect={(box, correction) => { correct(index, box, correction); }}
							confirmed={confirmed}
							onConfirm={(box, yes) => { confirm(index, box, yes); }}
							boxId={(box) => boxId(index, box)}
							onBoxClosed={onBoxClosed}
						/>
					)
					: (
						<section
							key={index}
							className={styles.failedPage}
							id={pdfPages !== undefined ? pdfPageId(index + 1) : undefined}
						>
							<h3>{title}</h3>
							<p className={styles.error}>{problem}</p>
						</section>
					)
			))}
			<FlaggedWords
				left={toCheck.length}
				total={flagged.length}
				onNext={() => { nextToCheck(); }}
				onPrevious={previousFlagged}
			/>
		</section>
	);
}
