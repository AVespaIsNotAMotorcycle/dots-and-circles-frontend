'use client'

import axios from 'axios';
import type { AxiosResponse } from 'axios';
import { useState, useEffect, useRef } from 'react';

import styles from './demo.module.css';
import LoadingCard from './LoadingCard';
import type { LoadingMessage } from './LoadingCard';
import PageResult from './PageResult';
import type { ReadPage } from './PageResult';
import PdfSummary from './PdfSummary';
import SamplePageForm from './SamplePageForm';
import SaveText from './SaveText';
import UploadForm from './UploadForm';
import { boxKey, unresolvedFlags } from './corrections';
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
	// The user's words for some of its boxes, which outlast reading it again
	// in edited boxes, as the boxes they're for keep their place
	corrections?: Corrections;
	// The boxes whose flagged reading the user marked as right, which last
	// as the corrections do
	confirmed?: Confirmed;
};

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

// The server's {"error": ...} for a failed request, or fallback
const errorMessage = (error: unknown, fallback: string) => (
	axios.isAxiosError<ErrorResponse>(error) && error.response?.data?.error
) || fallback;

// Sends an image of a page to be read
const postPage = (file: File) => {
	const body = new FormData();
	body.append('image', file);
	return axios.post<Page>(`${BACKEND}/upload/multiple`, body);
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
		send: () => Promise<AxiosResponse<T>>,
		fallback: string,
		expected: (result: T) => string,
	) => {
		const current = ++run.current;
		readingPdf.current = false;
		setProgress(undefined);
		setLoading(loadingMessage);
		setPdfPages(undefined);
		setError(undefined);
		inTurn(send)
			.then(({ data }) => {
				if (current !== run.current) return;
				setReadings([{ result: data, expected: expected(data) }]);
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
		request('readingPage', () => postPage(file), 'Couldn\'t read the page.',
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
				const { data } = await inTurn(() => postPage(file));
				reading = { title, result: data, expected: expected(page) };
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
	const reread = (index: number, boxes: EditedBox[]) => {
		const current = run.current;
		const old = readings[index].result!;
		return inTurn(() => axios.post<Page>(`${BACKEND}/upload/multiple/boxes`,
			{ image: old.image, boxes }))
			.then(({ data }) => {
				if (current !== run.current) return;
				const result: ReadPage = { ...old, ...data, angle: old.angle };
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
			() => axios.get<SamplePage>(`${BACKEND}/random`,
				{ params: { source: 'page', ...(name && { name }) } }),
			'Couldn\'t load a page.',
			(result) => {
				setSaveName(result.name);
				return result.transcription;
			});
	};

	// Without the list of pages, only a random one can be picked
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
				/>
				<SamplePageForm
					disabled={busy}
					names={pageNames}
					onLoad={loadPage}
				/>
				<LoadingCard
					loading={Boolean(loading) || !backendAwake}
					message={backendAwake && loading ? loading : 'wakingServer'}
					text={backendAwake && progress
						? `Reading page ${progress.page} of ${progress.pages}...`
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
			<FlaggedWords count={toCheck.length} onNext={() => { nextToCheck(); }} />
		</section>
	);
}
