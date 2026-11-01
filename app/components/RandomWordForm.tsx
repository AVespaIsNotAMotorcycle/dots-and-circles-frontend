'use client'

import { useState } from 'react';

import styles from './wordforms.module.css';

// Picks where random words come from and asks for one with onLoad(source)
export default function RandomWordForm({
	hidden = false,
	disabled = false,
	onLoad = (source) => {},
}) {
	// 'photo' or 'synthetic'
	const [source, setSource] = useState('photo');

	return (
		<div className={styles.options} hidden={hidden}>
			<label>
				Random words from
				<select
					value={source}
					onChange={(event) => { setSource(event.target.value); }}
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
