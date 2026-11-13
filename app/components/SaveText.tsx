import { useEffect, useState } from 'react';

import { pageText } from './corrections';
import { ROMANIZATION_NAMES } from './romanization';
import type { Romanization } from './romanization';
import { useRomanization } from './RomanizationContext';
import type { Corrections, Page } from './types';
import styles from './savetext.module.css';

// Manchu script, romanized (in the romanization chosen for the site), or
// both
type Script = 'manchu' | 'romanized' | 'both';

// The text of the pages on show, as the user has corrected it: for one
// page, its text; for a PDF's, each page's under its heading, and a note
// for a page that couldn't be read. Both give the Manchu, then the
// romanization.
export function readingText(
	readings: { title?: string; result?: Page; corrections?: Corrections }[],
	script: Script,
	romanization: Romanization,
	withOther: boolean,
) {
	const scripts = script === 'manchu' ? ['manchu' as const]
		: script === 'romanized' ? [romanization] : ['manchu' as const, romanization];
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

// Saves the text of the pages on show as a .txt, in Manchu, the site's
// romanization (Abkai or Norman) or both, with other text (such as Chinese)
// as □ or left out
export default function SaveText({ readings, name }: {
	readings: { title?: string; result?: Page; corrections?: Corrections }[];
	// The file's name, without .txt: the upload's or the sample page's
	name: string;
}) {
	const [script, setScript] = useState<Script>('both');
	const [withOther, setWithOther] = useState(true);
	const [romanization] = useRomanization();
	// How the last copy went, shown for a moment beside the button
	const [copied, setCopied] = useState<'copied' | 'failed'>();
	useEffect(() => {
		if (!copied) return;
		const timer = setTimeout(() => { setCopied(undefined); }, 2500);
		return () => { clearTimeout(timer); };
	}, [copied]);
	if (!readings.some(({ result }) => result)) return null;
	const text = () => readingText(readings, script, romanization, withOther);
	const copy = async () => {
		try {
			await navigator.clipboard.writeText(text());
			setCopied('copied');
		} catch {
			setCopied('failed');
		}
	};
	const scriptOptions: { value: Script; label: string }[] = [
		{ value: 'manchu', label: 'Manchu' },
		{ value: 'romanized', label: ROMANIZATION_NAMES[romanization] },
		{ value: 'both', label: 'Both' },
	];
	const suffix = script === 'both' ? ''
		: ` (${script === 'manchu' ? 'Manchu' : ROMANIZATION_NAMES[romanization]})`;

	return (
		<section className={styles.save} aria-labelledby="save-text-title">
			<h3 id="save-text-title">Save or copy the text</h3>
			<div className={styles.options}>
				<fieldset>
					<legend>Script</legend>
					{scriptOptions.map(({ value, label }) => (
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
					onClick={() => { download(text(), `${name}${suffix}.txt`); }}
				>
					Save as .txt
				</button>
				<button type="button" onClick={copy}>
					Copy
				</button>
				<span className={copied === 'failed' ? styles.failed : styles.copied} role="status">
					{copied === 'copied' && '✓ Copied'}
					{copied === 'failed' && 'Couldn\'t copy: try Save as .txt'}
				</span>
			</div>
			<p className={styles.hint}>
				A line per column, with your corrections.
				{readings.length > 1 && ' Each page under its heading.'}
			</p>
		</section>
	);
}
