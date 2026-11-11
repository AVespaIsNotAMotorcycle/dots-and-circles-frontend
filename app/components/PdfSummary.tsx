import { wordsRight } from './pagecompare';
import styles from './pdfsummary.module.css';
import type { Page } from './types';

const percent = (value: number) => value
	.toLocaleString(undefined, { style: 'percent', maximumFractionDigits: 1 });

// The accuracy over a whole PDF: words right across every page with text to
// compare with, and each page's own count, linking to it. While pages are
// still being read, it covers those read so far.
export default function PdfSummary({ readings, pages, pageId }: {
	// The pages read so far, in order: the reading (none if it failed) and
	// the Abkai expected on it ('' if none)
	readings: { result?: Page; expected: string }[];
	// How many pages the PDF has
	pages: number;
	// The element id of page number (from 1)'s result
	pageId: (page: number) => string;
}) {
	const counts = readings.map(({ result, expected }) => (
		result && expected ? wordsRight(result.abkai, expected) : undefined
	));
	const compared = counts.filter((count) => count !== undefined);
	if (!compared.length) return null;
	const right = compared.reduce((sum, { right: r }) => sum + r, 0);
	const total = compared.reduce((sum, { total: t }) => sum + t, 0);
	const unread = pages - readings.length;
	const uncompared = readings.length - compared.length;

	return (
		<section className={styles.summary} aria-live="polite">
			<h3>Whole PDF</h3>
			<p className={styles.total}>
				<strong>{percent(total ? right / total : 0)}</strong>
				{` of words right: ${right} of ${total}, over ${compared.length} ${compared.length === 1 ? 'page' : 'pages'}`}
				{unread > 0 && ` so far (${unread} still to read)`}
				.
			</p>
			{uncompared > 0 && (
				<p className={styles.note}>
					{`${uncompared} ${uncompared === 1 ? 'page has' : 'pages have'} no text to compare with${readings.some(({ result }) => !result) ? ', or couldn\'t be read' : ''}, and ${uncompared === 1 ? 'isn\'t' : 'aren\'t'} counted.`}
				</p>
			)}
			<ol className={styles.pages}>
				{counts.map((count, index) => (
					<li key={index}>
						<a href={`#${pageId(index + 1)}`}>
							<span className={styles.pageName}>{`Page ${index + 1}`}</span>
							<span>
								{count
									? `${percent(count.total ? count.right / count.total : 0)} (${count.right}/${count.total})`
									: '—'}
							</span>
						</a>
					</li>
				))}
			</ol>
		</section>
	);
}
