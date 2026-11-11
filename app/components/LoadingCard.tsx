import styles from './loadingcard.module.css';

export type LoadingMessage = 'wakingServer' | 'readingPage' | 'loadingPage'
	| 'loadingWords' | 'readingPdf';

const MESSAGES: Record<LoadingMessage, string> = {
	wakingServer: 'Waking up the server...',
	readingPage: 'Reading your page...',
	loadingPage: 'Loading and reading a sample page...',
	loadingWords: 'Loading the test words and their readings...',
	readingPdf: 'Reading your PDF...',
};

export default function LoadingCard({
	loading = false,
	message,
	text,
	children,
}: {
	loading?: boolean;
	message: LoadingMessage;
	// Shown instead of message's text, e.g. with a count
	text?: string;
	// Shown after the text, e.g. a Stop button
	children?: React.ReactNode;
}) {
	if (!loading) return null;

	return (
		<div className={styles.loadingCard} role="status">
			<span className={styles.spinner} aria-hidden="true" />
			<p>{text ?? MESSAGES[message]}</p>
			{children}
		</div>
	);
}
