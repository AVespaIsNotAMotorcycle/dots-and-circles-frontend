import styles from './loadingcard.module.css';

export type LoadingMessage = 'wakingServer' | 'readingPage' | 'loadingPage'
	| 'loadingWords';

const MESSAGES: Record<LoadingMessage, string> = {
	wakingServer: 'Waking up the server...',
	readingPage: 'Reading your page...',
	loadingPage: 'Loading and reading a sample page...',
	loadingWords: 'Loading the test words and their readings...',
};

export default function LoadingCard({
	loading = false,
	message,
}: {
	loading?: boolean;
	message: LoadingMessage;
}) {
	if (!loading) return null;

	return (
		<div className={styles.loadingCard} role="status">
			<span className={styles.spinner} aria-hidden="true" />
			<p>{MESSAGES[message]}</p>
		</div>
	);
}
