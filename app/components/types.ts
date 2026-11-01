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
