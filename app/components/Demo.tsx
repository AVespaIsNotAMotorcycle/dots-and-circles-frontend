'use client'

import axios from 'axios';
import type { AxiosResponse } from 'axios';
import { useState, useEffect, useRef } from 'react';

import styles from './demo.module.css';
import LoadingCard from './LoadingCard';
import type { LoadingMessage } from './LoadingCard';
import PageResult from './PageResult';
import SamplePageForm from './SamplePageForm';
import UploadForm from './UploadForm';
import type { ErrorResponse, Page, SamplePage } from './types';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND

// One page read: the backend's /upload/multiple or /random?source=page
// response and the Abkai expected ('' if unknown), or why it couldn't be
// read. title heads it, for a PDF's pages.
type Reading = {
	title?: string;
	result?: Page | SamplePage;
	expected: string;
	error?: string;
};

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
	const [error, setError] = useState<string>();
	// The sample pages' names, from GET /pages
	const [pageNames, setPageNames] = useState<string[]>([]);
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
		setError(undefined);
		setReadings([]);
		setLoading('readingPdf');
		for (let page = 1; page <= pages; page++) {
			setProgress({ page, pages });
			const title = `Page ${page}`;
			let reading: Reading;
			try {
				const file = await render(page);
				if (current !== run.current) return;
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

	// Loads the sample page with this name, or any one for ''
	const loadPage = (name = '') => {
		request('loadingPage',
			() => axios.get<SamplePage>(`${BACKEND}/random`,
				{ params: { source: 'page', ...(name && { name }) } }),
			'Couldn\'t load a page.',
			(result) => result.transcription);
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
			{readings.map(({ title, result, expected, error: problem }, index) => (
				result
					? <PageResult key={index} page={result} expected={expected} title={title} />
					: (
						<section key={index} className={styles.failedPage}>
							<h3>{title}</h3>
							<p className={styles.error}>{problem}</p>
						</section>
					)
			))}
		</section>
	);
}
