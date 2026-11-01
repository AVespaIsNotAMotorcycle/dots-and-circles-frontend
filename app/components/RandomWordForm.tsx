'use client'

import { useState } from 'react';

import type { Source } from './types';
import styles from './wordforms.module.css';

// Picks where random words come from and asks for one with onLoad(source)
export default function RandomWordForm({
	hidden = false,
	disabled = false,
	onLoad = (source: Source) => {},
}: {
	hidden?: boolean;
	disabled?: boolean;
	onLoad?: (source: Source) => void;
}) {
	const [source, setSource] = useState<Source>('photo');

	return (
		<div className={styles.options} hidden={hidden}>
			<label>
				Random words from
				<select
					value={source}
					onChange={(event) => { setSource(event.target.value as Source); }}
				>
					<option value="photo">Real photos</option>
					<option value="synthetic">Synthetic renders</option>
				</select>
			</label>
			<button
				type="button"
				disabled={disabled}
				onClick={() => { onLoad(source); }}
			>
				Load Random Word
			</button>
		</div>
	);
}
