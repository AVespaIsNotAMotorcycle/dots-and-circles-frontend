// The backend's JSON, as documented in dots-and-circles' server/README.md

// Where GET /random picks its word from
export type Source = 'photo' | 'synthetic';

// The most likely class at each image token: a letter, or null for the blank
export type Ctc = (string | null)[];

// One model's reading of a word
export type ModelResult = {
	// Short and long names of the model
	name: string;
	model: string;
	'prediction-manchu': string;
	'prediction-abkai': string;
	ctc: Ctc;
	// The probability of each token's class in ctc
	probs: number[];
	// Character accuracy against the label, or null without one
	score: number | null;
};

// A word read by every model: GET /random or POST /upload/single
export type Word = {
	source: Source | 'upload';
	// The font a synthetic word was rendered in, null otherwise
	font: string | null;
	// The word in Abkai and in Manchu script. Both are null for an upload
	// without a label.
	label: string | null;
	manchu: string | null;
	// The image before and after the default preprocessing, as data: URLs
	image: string;
	'preprocessed-image': string;
	results: ModelResult[];
};

// The body of a failed request
export type ErrorResponse = { error: string };

// One box found on a page by POST /upload/multiple
export type PageBox = {
	// Where it is in the page's (deskewed) image, in pixels
	x: number;
	y: number;
	w: number;
	h: number;
	// The part of the page inside the box, as a PNG data: URL
	image: string;
	// Its line of the page's text, or null if its column has no Manchu
	line: number | null;
	// Its place in its column, counting from the top
	position: number;
	kind: 'manchu' | 'other';
	// The classifier's probability that the box is Manchu
	'manchu-probability': number;
	// The model's reading, null for other boxes
	'prediction-manchu': string | null;
	'prediction-abkai': string | null;
	confidence: number | null;
};

// A page read by one model: POST /upload/multiple
export type Page = {
	// The name of the model that read it
	model: string;
	// The page, deskewed and with nothing drawn on it, as a data: URL. Box
	// coordinates are in this image.
	image: string;
	// How far the page was turned anticlockwise to straighten it, in degrees
	angle: number;
	// The text, a line per column with Manchu in it, words separated by
	// spaces and □ for each box of other text
	manchu: string;
	abkai: string;
	// In reading order
	boxes: PageBox[];
};

// A sample real page read by one model: GET /random?source=page, with
// ?name= for a particular one
export type SamplePage = Page & {
	source: 'page';
	name: string;
	// The page as saved, before deskewing, as a data: URL
	'original-image': string;
	// The known text: a line per Manchu column, in Abkai with punctuation
	transcription: string;
	// How the reading compares with the transcription, from 0 to 1
	score: { characters: number; words: number };
	// Who to credit for the page, and a link to it, null if not listed
	credit: string | null;
	link: string | null;
};
