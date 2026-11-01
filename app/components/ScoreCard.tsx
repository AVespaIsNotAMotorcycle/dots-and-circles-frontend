import styles from './scorecard.module.css';

// score is null for a word without a label
export default function ScoreCard({ score }: { score: number | null }) {
	// Unlabelled uploads have nothing to score against
	if (score === null || score === undefined) return null;

	const scoreColorBrackets: [number, string][] = [
		[1, 'green'],
		[0.9, 'yellow'],
		[0.7, 'orange'],
		[0, 'red'],
	];

	const scorePercentString = score
		.toLocaleString(undefined,{style: 'percent', minimumFractionDigits:2});
	const scoreColor = scoreColorBrackets
		.find(([threshold]) => score >= threshold)?.[1] ?? 'red';

	return (
		<div className={[styles.scoreCard, styles[scoreColor]].join(' ')}>
			<p>{`Score: ${scorePercentString}`}</p>
		</div>
	);
}
