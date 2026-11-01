import styles from './loadingcard.module.css';

const MESSAGES = {
  wakingServer: 'Waking up the server...',
  loadingPredictions: 'Loading lexigraph and model predictions...',
  readingUpload: 'Reading your image...',
};

export default function LoadingCard({ loading = false, message }) {
  if (!loading) return null;

  return (
    <div className={styles.loadingCard} role="status">
      <span className={styles.spinner} aria-hidden="true" />
      <p>{MESSAGES[message]}</p>
    </div>
  );
}
