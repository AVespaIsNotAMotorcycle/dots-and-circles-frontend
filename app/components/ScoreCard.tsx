import styles from './scorecard.module.css';

export default function ScoreCard({ score }) {
  const scoreColorBrackets = [
    [1, 'green'],
    [0.9, 'yellow'],
    [0.7, 'orange'],
    [0, 'red'],
  ];

  const scorePercentString = score
    .toLocaleString(undefined,{style: 'percent', minimumFractionDigits:2});
  const scoreColor = scoreColorBrackets.find(([threshold, color]) => {
    if (score >= threshold) return true;
    return false;
  })[1];

  return (
    <div className={[styles.scoreCard, styles[scoreColor]].join(' ')}>
	  <p>{`Score: ${scorePercentString}`}</p>
	</div>
  );
}
