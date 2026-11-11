// Opens PDFs and renders their pages as images in the browser, so each page
// can be sent to POST /upload/multiple like any other image. PDF.js is large,
// so it's only loaded once a PDF is picked.

import type { PDFDocumentProxy } from 'pdfjs-dist';

export type { PDFDocumentProxy };

// The server shrinks uploads to 2000 pixels on their longest side, so pages
// are rendered at that size
const LONGEST_SIDE = 2000;

const loadPdfjs = async () => {
	const pdfjs = await import('pdfjs-dist');
	pdfjs.GlobalWorkerOptions.workerSrc = new URL(
		'pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url,
	).toString();
	return pdfjs;
};

export const isPdf = (file: File) => file.type === 'application/pdf'
	|| file.name.toLowerCase().endsWith('.pdf');

// The PDF in file. Rejects if it can't be read.
export async function openPdf(file: File): Promise<PDFDocumentProxy> {
	const pdfjs = await loadPdfjs();
	const data = new Uint8Array(await file.arrayBuffer());
	return pdfjs.getDocument({ data }).promise;
}

// Page number (from 1) of pdf as a JPEG, named after the PDF and the page
export async function renderPage(
	pdf: PDFDocumentProxy, number: number, name: string,
): Promise<File> {
	const page = await pdf.getPage(number);
	const { width, height } = page.getViewport({ scale: 1 });
	const viewport = page.getViewport({
		scale: LONGEST_SIDE / Math.max(width, height),
	});
	const canvas = document.createElement('canvas');
	canvas.width = Math.round(viewport.width);
	canvas.height = Math.round(viewport.height);
	await page.render({ canvas, viewport }).promise;
	page.cleanup();
	const blob = await new Promise<Blob | null>((resolve) => {
		canvas.toBlob(resolve, 'image/jpeg', 0.92);
	});
	if (!blob) throw new Error('Couldn\'t render the page.');
	const base = name.replace(/\.pdf$/i, '');
	return new File([blob], `${base}, page ${number}.jpg`, { type: 'image/jpeg' });
}
