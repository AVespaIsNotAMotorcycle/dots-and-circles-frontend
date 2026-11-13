// The server shrinks pages to 2000 pixels on their longest side, so a big
// image is shrunk here first, to save uploading the rest: a phone photo of
// 3-5 MB is about 0.3 MB at 2000 pixels as a JPEG. An image that's already
// that small (or a PNG scan that size) is sent as it is, as JPEG changes
// the reading a little. See the backend's server/README.md.

const LONGEST_SIDE = 2000;
const JPEG_QUALITY = 0.92;

// Loads an image file, turned upright by its EXIF orientation as browsers
// now draw them (as the server would turn it)
function loadImage(file: File): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const url = URL.createObjectURL(file);
		const image = new Image();
		image.onload = () => {
			URL.revokeObjectURL(url);
			resolve(image);
		};
		image.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error('Couldn\'t open the image.'));
		};
		image.src = url;
	});
}

// The image to send for a page: the file itself if it's no more than 2000
// pixels on its longest side, or else shrunk to that as a JPEG, on white
// (as the server puts a transparent image on white). If it can't be shrunk
// here, the server shrinks it.
export async function shrinkForUpload(file: File): Promise<File> {
	try {
		const image = await loadImage(file);
		const longest = Math.max(image.naturalWidth, image.naturalHeight);
		if (longest <= LONGEST_SIDE) return file;
		const scale = LONGEST_SIDE / longest;
		const canvas = document.createElement('canvas');
		canvas.width = Math.round(image.naturalWidth * scale);
		canvas.height = Math.round(image.naturalHeight * scale);
		const context = canvas.getContext('2d');
		if (!context) return file;
		context.fillStyle = 'white';
		context.fillRect(0, 0, canvas.width, canvas.height);
		context.imageSmoothingQuality = 'high';
		context.drawImage(image, 0, 0, canvas.width, canvas.height);
		const blob = await new Promise<Blob | null>((resolve) => {
			canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY);
		});
		if (!blob) return file;
		const base = file.name.replace(/\.[^.]+$/, '') || 'page';
		return new File([blob], `${base}.jpg`, { type: 'image/jpeg' });
	} catch {
		return file;
	}
}
