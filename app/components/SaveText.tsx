import { useState } from 'react';

import { pageText } from './corrections';
import type { Corrections, Page } from './types';
import styles from './savetext.module.css';

type Script = 'manchu' | 'abkai' | 'both';

const SCRIPTS: { value: Script; label: string }[] = [
	{ value: 'manchu', label: 'Manchu' },
	{ value: 'abkai', label: 'Abkai' },
	{ value: 'both', label: 'Both' },
];

// The text of the pages on show, as the user has corrected it: for one
// page, its text; for a PDF's, each page's under its heading, and a note
// for a page that couldn't be read. Both scripts give the Manchu, then the
// Abkai.
export function readingText(
	readings: { title?: string; result?: Page; corrections?: Corrections }[],
	script: Script,
	withOther: boolean,
) {
	const scripts = script === 'both' ? ['manchu', 'abkai'] as const : [script];
	const pages = readings.map(({ title, result, corrections = {} }) => {
		const body = result
			? scripts.map((one) => pageText(result, corrections, one, withOther)).join('\n\n')
			: '(This page couldn\'t be read.)';
		return readings.length > 1 && title ? `${title}\n\n${body}` : body;
	});
	return `${pages.join('\n\n\n')}\n`;
}

// Hands the user a text file to save
function download(text: string, fileName: string) {
	const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
	const link = document.createElement('a');
	link.href = url;
	link.download = fileName;
	document.body.append(link);
	link.click();
	link.remove();
	URL.revokeObjectURL(url);
}

// Saves the text of the pages on show as a .txt, in Manchu, Abkai or both,
// with other text (such as Chinese) as □ or left out
export default function SaveText({ readings, name }: {
	readings: { title?: string; result?: Page; corrections?: Corrections }[];
	// The file's name, without .txt: the upload's or the sample page's
	name: string;
}) {
	const [script, setScript] = useState<Script>('both');
	const [withOther, setWithOther] = useState(true);
	if (!readings.some(({ result }) => result)) return null;
	const suffix = script === 'both' ? '' : ` (${script === 'manchu' ? 'Manchu' : 'Abkai'})`;

	return (
		<section className={styles.save} aria-labelledby="save-text-title">
			<h3 id="save-text-title">Save the text</h3>
			<div className={styles.options}>
				<fieldset>
					<legend>Script</legend>
					{SCRIPTS.map(({ value, label }) => (
						<label key={value}>
							<input
								type="radio"
								name="save-script"
								checked={script === value}
								onChange={() => { setScript(value); }}
							/>
							{label}
						</label>
					))}
				</fieldset>
				<fieldset>
					<legend>Other text, such as Chinese</legend>
					<label>
						<input
							type="radio"
							name="save-other"
							checked={withOther}
							onChange={() => { setWithOther(true); }}
						/>
						As □
					</label>
					<label>
						<input
							type="radio"
							name="save-other"
							checked={!withOther}
							onChange={() => { setWithOther(false); }}
						/>
						Leave out
					</label>
				</fieldset>
				<button
					type="button"
					onClick={() => {
						download(readingText(readings, script, withOther), `${name}${suffix}.txt`);
					}}
				>
					Save as .txt
				</button>
			</div>
			<p className={styles.hint}>
				A line per column, with your corrections.
				{readings.length > 1 && ' Each page under its heading.'}
			</p>
		</section>
	);
}
