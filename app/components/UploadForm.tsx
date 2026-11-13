'use client'

import { useState, useEffect, useRef } from 'react';

import { textForPage } from './pagecompare';
import { isPdf, openPdf, renderPage } from './pdf';
import { transcriptionFromText } from './transcription';
import type { PDFDocumentProxy } from './pdf';
import styles from './wordforms.module.css';

// Resolves to why an image file can't be uploaded, or undefined if it can
function checkImage(file: File): Promise<string | undefined> {
	return new Promise((resolve) => {
		const url = URL.createObjectURL(file);
		const image = new Image();
		image.onload = () => {
			URL.revokeObjectURL(url);
			resolve(undefined);
		};
		image.onerror = () => {
			URL.revokeObjectURL(url);
			resolve('That file isn\'t an image that can be read.');
		};
		image.src = url;
	});
}

// The first image or PDF among a paste's or drop's files, if any
const firstUsable = (files: FileList | null | undefined) => Array.from(files ?? [])
	.find((file) => file.type.startsWith('image/') || isPdf(file));

// Picks an image of a page, or a page of a PDF (from the file picker, a drop
// or a paste), and the Abkai it says, optionally, and hands both to onRead.
// A PDF's page is sent as an image. onError(message) reports a problem with
// the file, and onError(undefined) clears it.
export default function UploadForm({
	hidden = false,
	disabled = false,
	onRead = () => {},
	onReadAll = () => {},
	onFileChange = () => {},
	onError = () => {},
	beside,
}: {
	// Shown on the left of the read buttons' row, such as the sample pages
	beside?: React.ReactNode;
	hidden?: boolean;
	disabled?: boolean;
	onRead?: (file: File, label: string) => void;
	// Asks for every page of a PDF to be read: how many there are, a
	// function that renders one (from 1) as an image to send, and one that
	// gives the Abkai expected on it
	onReadAll?: (
		pages: number,
		render: (page: number) => Promise<File>,
		expected: (page: number) => string,
	) => void;
	// Called whenever a new file is picked, so a PDF being read can stop
	onFileChange?: () => void;
	onError?: (message: string | undefined) => void;
}) {
	// The user's image once it passes checkImage (or the PDF's page, once
	// rendered), and its optional label
	const [upload, setUpload] = useState<File>();
	const [uploadLabel, setUploadLabel] = useState('');
	// Whether the transcription box is open: it's out of the way until wanted
	const [showTranscription, setShowTranscription] = useState(false);
	// An object URL of upload, for its thumbnail
	const [uploadPreview, setUploadPreview] = useState<string>();
	// True while a file is dragged over the drop zone
	const [dragging, setDragging] = useState(false);
	// The user's PDF, if they picked one, with its file name
	const [pdf, setPdf] = useState<{ doc: PDFDocumentProxy; name: string }>();
	// The page number box's text, which may be mid-edit, and true while the
	// page it names is rendered
	const [pageInput, setPageInput] = useState('1');
	const [rendering, setRendering] = useState(false);
	// The PDF page that upload is, which the box may no longer name mid-edit
	const [shownPage, setShownPage] = useState(1);
	// The PDF open now, to close when it's replaced. Each new file or page
	// bumps request, so a slow render that's been overtaken is dropped.
	const openDoc = useRef<PDFDocumentProxy>(undefined);
	const request = useRef(0);

	useEffect(() => () => { openDoc.current?.loadingTask.destroy(); }, []);

	const clearUpload = () => {
		setUpload(undefined);
		setUploadPreview((previous) => {
			if (previous) URL.revokeObjectURL(previous);
			return undefined;
		});
	};

	// Renders page number of doc and makes it the upload
	const showPage = async (doc: PDFDocumentProxy, name: string, number: number) => {
		const current = ++request.current;
		clearUpload();
		onError(undefined);
		setRendering(true);
		try {
			const file = await renderPage(doc, number, name);
			if (current !== request.current) return;
			setShownPage(number);
			setUpload(file);
			setUploadPreview(URL.createObjectURL(file));
		} catch {
			if (current === request.current) onError(`Couldn't render page ${number} of the PDF.`);
		} finally {
			if (current === request.current) setRendering(false);
		}
	};

	const takeFile = async (file: File | undefined) => {
		const current = ++request.current;
		onFileChange();
		clearUpload();
		setRendering(false);
		onError(undefined);
		openDoc.current?.loadingTask.destroy();
		openDoc.current = undefined;
		setPdf(undefined);
		if (!file) return;
		if (isPdf(file)) {
			setRendering(true);
			let doc: PDFDocumentProxy;
			try {
				doc = await openPdf(file);
			} catch {
				if (current === request.current) {
					setRendering(false);
					onError('That file isn\'t a PDF that can be read.');
				}
				return;
			}
			if (current !== request.current) {
				doc.loadingTask.destroy();
				return;
			}
			openDoc.current = doc;
			setPdf({ doc, name: file.name });
			setPageInput('1');
			showPage(doc, file.name, 1);
			return;
		}
		const problem = await checkImage(file);
		if (current !== request.current) return;
		if (problem) {
			onError(problem);
			return;
		}
		setUpload(file);
		setUploadPreview(URL.createObjectURL(file));
	};

	const onDrop = (event: React.DragEvent) => {
		event.preventDefault();
		setDragging(false);
		const file = firstUsable(event.dataTransfer.files);
		if (file) {
			takeFile(file);
		} else {
			onError('That isn\'t an image or a PDF.');
		}
	};

	// The Paste button reads the clipboard directly. Browsers that can't
	// (or that the user denies) can still paste with Ctrl+V.
	const pasteFromClipboard = async () => {
		const fallback = 'Couldn\'t read the clipboard here. Press Ctrl+V (⌘V on a Mac) instead.';
		if (!navigator.clipboard?.read) {
			onError(fallback);
			return;
		}
		try {
			for (const item of await navigator.clipboard.read()) {
				const type = item.types.find((t) => t.startsWith('image/'));
				if (!type) continue;
				const blob = await item.getType(type);
				takeFile(new File([blob], 'Pasted image', { type }));
				return;
			}
			onError('There\'s no image on the clipboard.');
		} catch {
			onError(fallback);
		}
	};

	// Ctrl+V anywhere on the page pastes an image while the form shows.
	// Pastes without one (like text into the label) are left alone.
	useEffect(() => {
		if (hidden) return;
		const onPaste = (event: ClipboardEvent) => {
			const file = firstUsable(event.clipboardData?.files);
			if (!file) return;
			event.preventDefault();
			takeFile(file);
		};
		document.addEventListener('paste', onPaste);
		return () => { document.removeEventListener('paste', onPaste); };
	}, [hidden]);

	// Fills the transcription box from a .txt, as Save the text writes them
	const loadTranscription = async (file: File | undefined) => {
		if (!file) return;
		let text: string;
		try {
			text = transcriptionFromText(await file.text());
		} catch {
			onError('Couldn\'t read that file.');
			return;
		}
		if (!text.trim()) {
			onError('That file has no text to compare with.');
			return;
		}
		onError(undefined);
		setUploadLabel(text);
		setShowTranscription(true);
	};
	const transcriptionLines = uploadLabel.split('\n').filter((line) => line.trim()).length;

	const onSubmit = (event: React.FormEvent) => {
		event.preventDefault();
		if (!upload) return;
		// A PDF's page is compared with its own paragraph of the text
		onRead(upload, pdf
			? textForPage(uploadLabel, shownPage, false)
			: uploadLabel.trim());
	};

	return (
		<form
			className={styles.options}
			hidden={hidden}
			onSubmit={onSubmit}
		>
			<div className={styles.inputs}>
			<div className={styles.field}>
			<span id="upload-title">Upload an image of a single page, or a PDF</span>
			<div
				role="group"
				aria-labelledby="upload-title"
				className={[styles.dropZone, dragging && styles.dragging]
					.filter(Boolean).join(' ')}
				onDragOver={(event) => {
					event.preventDefault();
					setDragging(true);
				}}
				onDragLeave={() => { setDragging(false); }}
				onDrop={onDrop}
			>
				{/* A fixed size, so the controls beside it stay put while it loads */}
				<div className={styles.preview}>
					{uploadPreview && <img src={uploadPreview} alt="" />}
				</div>
				<div className={styles.dropZoneControls}>
				<div className={styles.chosen}>
					<span>
						{pdf?.name ?? upload?.name ?? 'No file chosen'}
						{rendering && !pdf && ' (opening…)'}
					</span>
				</div>
				<div className={styles.dropZoneActions}>
					<label className={styles.chooseButton}>
						Choose file…
						<input
							type="file"
							accept="image/*,application/pdf,.pdf"
							className={styles.visuallyHidden}
							onChange={(event) => {
								takeFile(event.target.files?.[0]);
								// So picking the same file again still counts
								event.target.value = '';
							}}
						/>
					</label>
					<button type="button" onClick={pasteFromClipboard}>
						Paste image
					</button>
				</div>
				{pdf && (
					<label className={styles.pdfPage}>
						Page
						<input
							type="number"
							min={1}
							max={pdf.doc.numPages}
							value={pageInput}
							onChange={(event) => {
								setPageInput(event.target.value);
								const number = Number(event.target.value);
								if (Number.isInteger(number) && number >= 1
									&& number <= pdf.doc.numPages) {
									showPage(pdf.doc, pdf.name, number);
								}
							}}
						/>
						{`of ${pdf.doc.numPages}`}
						{rendering && <span className={styles.hint}>Rendering…</span>}
					</label>
				)}
				<span className={styles.hint}>
					or drag one here, or press Ctrl+V (⌘V on a Mac)
				</span>
				</div>
			</div>
			</div>
			<details
				className={styles.transcription}
				open={showTranscription}
				onToggle={(event) => { setShowTranscription(event.currentTarget.open); }}
			>
				<summary>
					Compare with a transcription
					<span className={styles.hint}>
						{transcriptionLines
							? ` · ${transcriptionLines} ${transcriptionLines === 1 ? 'line' : 'lines'} entered`
							: ' (optional)'}
					</span>
				</summary>
				<div className={styles.field}>
					<label htmlFor="upload-abkai">The text in Abkai</label>
					<span id="upload-abkai-hint" className={styles.hint}>
						A line per column, words separated by spaces. For a PDF, separate
						pages with an empty line. Or load a .txt saved from a reading here.
					</span>
					<textarea
						id="upload-abkai"
						aria-describedby="upload-abkai-hint"
						value={uploadLabel}
						rows={4}
						placeholder={'abka na\nbe\n\nmuke'}
						onChange={(event) => { setUploadLabel(event.target.value); }}
					/>
					<div className={styles.transcriptionActions}>
						<label className={styles.chooseButton}>
							Load from a .txt…
							<input
								type="file"
								accept=".txt,text/plain"
								className={styles.visuallyHidden}
								onChange={(event) => {
									loadTranscription(event.target.files?.[0]);
									// So loading the same file again still counts
									event.target.value = '';
								}}
							/>
						</label>
						{uploadLabel && (
							<button type="button" onClick={() => { setUploadLabel(''); }}>
								Clear
							</button>
						)}
					</div>
				</div>
			</details>
			</div>
			<div className={styles.submitRow}>
				{beside}
				<div className={styles.readButtons}>
				<button type="submit" disabled={disabled || !upload}>
					{pdf ? `Read Page ${shownPage}` : 'Read My Page'}
				</button>
				{pdf && (
					<button
						type="button"
						disabled={disabled}
						onClick={() => {
							const { doc, name } = pdf;
							const text = uploadLabel;
							onReadAll(doc.numPages,
								(page) => renderPage(doc, page, name),
								(page) => textForPage(text, page, true));
						}}
					>
						{`Read All ${pdf.doc.numPages} Pages`}
					</button>
				)}
				</div>
			</div>
		</form>
	);
}
