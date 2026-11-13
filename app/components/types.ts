// The backend's JSON, as documented in dots-and-circles' server/README.md

// The sets of test words GET /lexigraphs lists
export type Source = 'photo' | 'synthetic';

// One test word with a model's reading of it, from GET /lexigraphs
export type Lexigraph = {
	// Its place in the whole list
	index: number;
	// The word in Abkai and in Manchu script
	label: string;
	manchu: string;
	// The font a synthetic word was rendered in, null for a photo
	font: string | null;
	// The image, as a data: URL
	image: string;
	'prediction-manchu': string;
	'prediction-abkai': string;
	// The label and reading in Norman's romanization; missing from a server
	// from before it sent them
	'label-norman'?: string;
	'prediction-norman'?: string;
	// Character accuracy against the label, from 0 to 1
	score: number;
};

// A page of GET /lexigraphs
export type LexigraphPage = {
	source: Source;
	// The name of the model that read them
	model: string;
	page: number;
	'per-page': number;
	// Words and pages in the whole list
	total: number;
	pages: number;
	words: Lexigraph[];
};

// The body of a failed request
export type ErrorResponse = { error: string };

// A dictionary entry close to a box's reading
export type ClosestWord = {
	manchu: string;
	abkai: string;
	// Missing from a server from before it sent Norman
	norman?: string;
	// The edit distance from the reading, ignoring its punctuation
	distance: number;
	// The dictionaries listing it: Wiktionary and Norman's
	sources: ('kaikki' | 'norman')[];
};

// One box found on a page by POST /upload/multiple
export type PageBox = {
	// Where it is in the page's (deskewed) image, in pixels
	x: number;
	y: number;
	w: number;
	h: number;
	// The part of the page inside the box, as a PNG data: URL, or null when
	// asked for without them (?crops=false), as the frontend does
	image: string | null;
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
	// In Norman's romanization; missing from a server from before it sent it
	'prediction-norman'?: string | null;
	confidence: number | null;
	// True for Manchu read with too little confidence to be in the page's
	// text, null for other boxes
	'low-confidence': boolean | null;
	// The two dictionary entries closest to the reading, closest first. []
	// for a box read as nothing, and null for other boxes, or every box if
	// the server has no dictionary.
	'closest-words': ClosestWord[] | null;
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
	// The same in Norman's romanization; missing from a server from before
	// it sent it
	norman?: string;
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

// A box sent to POST /upload/multiple/boxes, in the page image's pixels.
// kind left out lets the classifier decide. A box the user hasn't changed
// is sent with its reading, so it isn't read again.
export type EditedBox = {
	x: number;
	y: number;
	w: number;
	h: number;
	kind?: 'manchu' | 'other';
	'prediction-manchu'?: string;
	confidence?: number;
};

// The user's own reading of a Manchu box, in place of the model's: picked
// from its closest dictionary words or typed in Abkai, or that it isn't
// Manchu, which reads as □ like other text
export type Correction = { manchu: string; abkai: string; notManchu?: true };
// A page's corrections, by boxKey
export type Corrections = Record<string, Correction>;
// The boxes of a page whose flagged reading the user marked as right, by
// boxKey
export type Confirmed = Record<string, true>;
