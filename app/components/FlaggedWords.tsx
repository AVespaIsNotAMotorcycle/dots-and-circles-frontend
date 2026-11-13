import styles from './flaggedwords.module.css';

// How many words on show are still flagged as possible misreadings, out of
// all flagged, kept in the bottom right corner of the screen while there
// are any left, with buttons to go to the next to check and back to the
// one before
export default function FlaggedWords({ left, total, onNext, onPrevious }: {
	left: number;
	total: number;
	onNext: () => void;
	onPrevious: () => void;
}) {
	if (left === 0) return null;
	return (
		<>
		{/* Room at the end of the page, so the box never covers the last of it */}
		<div className={styles.spacer} />
		<aside className={styles.flagged} aria-label="Words to check">
			<span className={styles.badge} aria-hidden="true">?</span>
			<p aria-live="polite">
				{`${left} left `}
				<span className={styles.total}>{`of ${total}`}</span>
				<span className={styles.visuallyHidden}> flagged words to check</span>
			</p>
			<button type="button" aria-label="Previous flagged word" onClick={onPrevious}>
				Previous
			</button>
			<button type="button" onClick={onNext}>Next word</button>
		</aside>
		</>
	);
}
