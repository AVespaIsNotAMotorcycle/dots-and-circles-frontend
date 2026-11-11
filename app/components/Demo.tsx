'use client'

import axios from 'axios';
import type { AxiosResponse } from 'axios';
import { useState, useEffect } from 'react';

import styles from './demo.module.css';
import LoadingCard from './LoadingCard';
import type { LoadingMessage } from './LoadingCard';
import PageResult from './PageResult';
import SamplePageForm from './SamplePageForm';
import UploadForm from './UploadForm';
import type { ErrorResponse, Page, SamplePage } from './types';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND

// Reads the user's page, or loads a sample one, and shows how it was read
export default function Demo({ backendAwake = false }: {
	backendAwake?: boolean;
}) {
	// The page on show, the backend's /upload/multiple or
	// /random?source=page response, and the Abkai expected ('' if unknown):
	// the user's, or the sample page's transcription
	const [page, setPage] = useState<{
		result: Page | SamplePage;
		expected: string;
	}>();
	// false, or the LoadingCard message to show
	const [loading, setLoading] = useState<LoadingMessage | false>(false);
	const [error, setError] = useState<string>();
	// The sample pages' names, from GET /pages
	const [pageNames, setPageNames] = useState<string[]>([]);

	// Runs a backend request for a page: shows loadingMessage meanwhile,
	// then the page, or the server's {"error": ...} (or fallback)
	const request = <T extends Page,>(
		loadingMessage: LoadingMessage,
		send: () => Promise<AxiosResponse<T>>,
		fallback: string,
		expected: (result: T) => string,
	) => {
		setLoading(loadingMessage);
		setError(undefined);
		send()
			.then(({ data }) => { setPage({ result: data, expected: expected(data) }); })
			.catch((error) => {
				setError((axios.isAxiosError<ErrorResponse>(error)
					&& error.response?.data?.error) || fallback);
			})
			.finally(() => { setLoading(false); });
	};

	// The server ignores a label for a page, so the comparison with the
	// expected Abkai is made here
	const readPage = (file: File, expected: string) => {
		const body = new FormData();
		body.append('image', file);
		request('readingPage',
			() => axios.post<Page>(`${BACKEND}/upload/multiple`, body),
			'Couldn\'t read the page.',
			() => expected);
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
				/>
				{error && <p className={styles.error} role="alert">{error}</p>}
			</div>
			{page && <PageResult page={page.result} expected={page.expected} />}
		</section>
	);
}
