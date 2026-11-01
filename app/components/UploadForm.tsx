'use client'

import { useState, useEffect } from 'react';

import styles from './wordforms.module.css';

// Words are written top to bottom, and the models read them at 32 pixels wide
// and squash anything over 256 tall, so taller than 1:8 is refused
const MAX_HEIGHT_PER_WIDTH = 8;

// Resolves to why an image file can't be uploaded, or undefined if it can.
// The browser applies EXIF orientation as the server does, so the
// dimensions match what the server sees.
function checkImage(file: File): Promise<string | undefined> {
	return new Promise((resolve) => {
		const url = URL.createObjectURL(file);
		const image = new Image();
		image.onload = () => {
			URL.revokeObjectURL(url);
			const { naturalWidth: width, naturalHeight: height } = image;
			if (height > width * MAX_HEIGHT_PER_WIDTH) {
				resolve(`The image is ${width}×${height}, taller than 1:${MAX_HEIGHT_PER_WIDTH}. Crop it closer to the word.`);
			} else {
				resolve(undefined);
			}
		};
		image.onerror = () => {
			URL.revokeObjectURL(url);
			resolve('That file isn\'t an image that can be read.');
		};
		image.src = url;
	});
}

// The first image among a paste's or drop's files, if any
const firstImage = (files: FileList | null | undefined) => Array.from(files ?? [])
	.find((file) => file.type.startsWith('image/'));

// Picks an image of one word (from the file picker, a drop or a paste) and
// an optional Abkai label, and hands both to onRead. onError(message) reports
// a problem with the image, and onError(undefined) clears it.
export default function UploadForm({
	hidden = false,
	disabled = false,
	onRead = () => {},
	onError = () => {},
}: {
	hidden?: boolean;
	disabled?: boolean;
	onRead?: (file: File, label: string) => void;
	onError?: (message: string | undefined) => void;
}) {
	// The user's image once it passes checkImage, and its optional label
	const [upload, setUpload] = useState<File>();
	const [uploadLabel, setUploadLabel] = useState('');
	// An object URL of upload, for its thumbnail
	const [uploadPreview, setUploadPreview] = useState<string>();
	// True while a file is dragged over the drop zone
	const [dragging, setDragging] = useState(false);

	const takeFile = async (file: File | undefined) => {
		setUpload(undefined);
		setUploadPreview((previous) => {
			if (previous) URL.revokeObjectURL(previous);
			return undefined;
		});
		onError(undefined);
		if (!file) return;
		const problem = await checkImage(file);
		if (problem) {
			onError(problem);
			return;
		}
		setUpload(file);
		setUploadPreview(URL.createObjectURL(file));
	};

	const onDrop = (event: React.DragEvent) => {
		event.preventDefault();
		setDragging(false);
		const file = firstImage(event.dataTransfer.files);
		if (file) {
			takeFile(file);
		} else {
			onError('That isn\'t an image.');
		}
	};

	// The Paste button reads the clipboard directly. Browsers that can't
	// (or that the user denies) can still paste with Ctrl+V.
	const pasteFromClipboard = async () => {
		const fallback = 'Couldn\'t read the clipboard here. Press Ctrl+V (⌘V on a Mac) instead.';
		if (!navigator.clipboard?.read) {
			onError(fallback);
			return;
		}
		try {
			for (const item of await navigator.clipboard.read()) {
				const type = item.types.find((t) => t.startsWith('image/'));
				if (!type) continue;
				const blob = await item.getType(type);
				takeFile(new File([blob], 'Pasted image', { type }));
				return;
			}
			onError('There\'s no image on the clipboard.');
		} catch {
			onError(fallback);
		}
	};

	// Ctrl+V anywhere on the page pastes an image while the form shows.
	// Pastes without one (like text into the label) are left alone.
	useEffect(() => {
		if (hidden) return;
		const onPaste = (event: ClipboardEvent) => {
			const file = firstImage(event.clipboardData?.files);
			if (!file) return;
			event.preventDefault();
			takeFile(file);
		};
		document.addEventListener('paste', onPaste);
		return () => { document.removeEventListener('paste', onPaste); };
	}, [hidden]);

	const onSubmit = (event: React.FormEvent) => {
		event.preventDefault();
		if (upload) onRead(upload, uploadLabel.trim());
	};

	return (
		<form className={styles.options} hidden={hidden} onSubmit={onSubmit}>
			<div
				className={[styles.dropZone, dragging && styles.dragging]
					.filter(Boolean).join(' ')}
				onDragOver={(event) => {
					event.preventDefault();
					setDragging(true);
				}}
				onDragLeave={() => { setDragging(false); }}
				onDrop={onDrop}
			>
				<span className={styles.dropZoneTitle}>
					Your image of one word, written top to bottom
				</span>
				<div className={styles.chosen}>
					{uploadPreview && <img src={uploadPreview} alt="" />}
					<span>{upload ? upload.name : 'No image chosen'}</span>
				</div>
				<div className={styles.dropZoneActions}>
					<label className={styles.chooseButton}>
						Choose image…
						<input
							type="file"
							accept="image/*"
							className={styles.visuallyHidden}
							onChange={(event) => {
								takeFile(event.target.files?.[0]);
								// So picking the same file again still counts
								event.target.value = '';
							}}
						/>
					</label>
					<button type="button" onClick={pasteFromClipboard}>
						Paste image
					</button>
				</div>
				<span className={styles.hint}>
					or drag one here, or press Ctrl+V (⌘V on a Mac)
				</span>
			</div>
			<label>
				What it says, in Abkai (optional)
				<input
					type="text"
					value={uploadLabel}
					placeholder="abka"
					onChange={(event) => { setUploadLabel(event.target.value); }}
				/>
			</label>
			<button type="submit" disabled={disabled || !upload}>
				Read My Image
			</button>
		</form>
	);
}
