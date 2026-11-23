import { useId, useRef, useState } from 'react';

import styles from './submitcorrections.module.css';

// The longest note the server takes with a submission
const NOTE_LENGTH = 2000;

// A button to send a checked page, its boxes and the user's corrections to
// be kept for training the model, once none of its flagged words are left
// to check. It asks first, for the user's agreement and any note.
export default function SubmitCorrections({
	left, onNextFlag, submitted, changed, onSubmit,
}: {
	// How many of the page's flagged words are still to check
	left: number;
	// Opens the page's next word to check
	onNextFlag: () => void;
	// Whether the page as it is now has been submitted
	submitted: boolean;
	// Whether it was submitted, but changed since
	changed: boolean;
	// Sends it, with the user's note ('' for none), rejecting with why it
	// couldn't be
	onSubmit: (note: string) => Promise<void>;
}) {
	const dialog = useRef<HTMLDialogElement>(null);
	const titleId = useId();
	const hintId = useId();
	const [agreed, setAgreed] = useState(false);
	const [note, setNote] = useState('');
	const [sending, setSending] = useState(false);
	const [error, setError] = useState<string>();

	const open = () => {
		setError(undefined);
		dialog.current?.showModal();
	};
	const close = () => {
		if (sending) return;
		dialog.current?.close();
	};
	const submit = () => {
		setSending(true);
		setError(undefined);
		onSubmit(note.trim())
			.then(() => {
				dialog.current?.close();
				setAgreed(false);
				setNote('');
			})
			.catch((reason: Error) => { setError(reason.message); })
			.finally(() => { setSending(false); });
	};

	const blocked = left > 0;
	return (
		<div className={styles.submit}>
			{submitted ? (
				<p className={styles.thanks} role="status">
					Submitted for training. Thank you!
				</p>
			) : (
				<>
					<button
						type="button"
						disabled={blocked}
						aria-describedby={hintId}
						onClick={open}
					>
						{changed ? 'Submit corrections again' : 'Submit corrections for training'}
					</button>
					<p id={hintId} className={styles.hint}>
						{blocked ? (
							<>
								{`${left} flagged ${left === 1 ? 'word' : 'words'} left to check first. `}
								<button type="button" className={styles.link} onClick={onNextFlag}>
									Check the next one
								</button>
							</>
						) : changed
							? 'You\'ve changed this page since you submitted it.'
							: 'Send this page, its boxes and your corrections to help improve the model.'}
					</p>
				</>
			)}
			<dialog
				ref={dialog}
				className={styles.dialog}
				aria-labelledby={titleId}
				onCancel={(event) => {
					if (sending) event.preventDefault();
				}}
				onClick={(event) => {
					if (event.target === event.currentTarget) close();
				}}
			>
				<form
					onSubmit={(event) => {
						event.preventDefault();
						submit();
					}}
				>
					<h4 id={titleId}>Submit corrections for training</h4>
					<label className={styles.agree}>
						<input
							type="checkbox"
							required
							checked={agreed}
							onChange={(event) => { setAgreed(event.target.checked); }}
						/>
						<span>
							I agree to this page, its boxes and my corrections being kept
							privately and used to improve the model. They won&apos;t be published.
						</span>
					</label>
					<label className={styles.note}>
						<span>
							Anything about this page we should know?
							{' '}
							<span className={styles.optional}>(optional)</span>
						</span>
						<textarea
							rows={3}
							maxLength={NOTE_LENGTH}
							value={note}
							onChange={(event) => { setNote(event.target.value); }}
						/>
					</label>
					{error && <p className={styles.error} role="alert">{error}</p>}
					<div className={styles.buttons}>
						<button type="button" onClick={close} disabled={sending}>Cancel</button>
						<button type="submit" disabled={!agreed || sending}>
							{sending ? 'Submitting…' : 'Submit'}
						</button>
					</div>
				</form>
			</dialog>
		</div>
	);
}
