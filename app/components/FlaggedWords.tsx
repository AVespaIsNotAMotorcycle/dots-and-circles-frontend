import styles from './flaggedwords.module.css';

// How many words on show are still flagged as possible misreadings, kept in
// the bottom right corner of the screen while there are any, with a button
// to go to the next
export default function FlaggedWords({ count, onNext }: {
	count: number;
	onNext: () => void;
}) {
	if (count === 0) return null;
	return (
		<>
		{/* Room at the end of the page, so the box never covers the last of it */}
		<div className={styles.spacer} />
		<aside className={styles.flagged} aria-label="Words to check">
			<span className={styles.badge} aria-hidden="true">?</span>
			<p aria-live="polite">
				{`${count} ${count === 1 ? 'word' : 'words'} to check`}
			</p>
			<button type="button" onClick={onNext}>Next word</button>
		</aside>
		</>
	);
}
