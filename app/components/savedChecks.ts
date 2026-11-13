// The user's corrections and readings marked right, kept in this browser
// for each page, so they outlast reloading it or reading it again

import type { Confirmed, Corrections } from './types';

export type SavedChecks = { corrections?: Corrections; confirmed?: Confirmed };

const PREFIX = 'dots-and-circles:checks:';

// A key for a page, from its image: two 32-bit FNV-1a hashes of the whole
// data: URL, with its length, so different pages practically never share one
export function pageKey(image: string) {
	let a = 0x811c9dc5;
	let b = 0x01000193;
	for (let i = 0; i < image.length; i++) {
		const code = image.charCodeAt(i);
		a = Math.imul(a ^ code, 0x01000193);
		b = Math.imul(b ^ code, 0x5bd1e995);
	}
	return `${PREFIX}${(a >>> 0).toString(36)}${(b >>> 0).toString(36)}-${image.length.toString(36)}`;
}

// What was kept for a page, if anything. Storage can be missing or
// blocked, which counts as nothing kept.
export function loadChecks(key: string): SavedChecks {
	try {
		const saved = JSON.parse(localStorage.getItem(key) ?? '{}') as SavedChecks;
		return {
			corrections: saved.corrections ?? {},
			confirmed: saved.confirmed ?? {},
		};
	} catch {
		return {};
	}
}

// Keeps a page's checks, or forgets them once there are none
export function saveChecks(key: string, { corrections = {}, confirmed = {} }: SavedChecks) {
	try {
		if (Object.keys(corrections).length || Object.keys(confirmed).length) {
			localStorage.setItem(key, JSON.stringify({ corrections, confirmed }));
		} else {
			localStorage.removeItem(key);
		}
	} catch {
		// Not kept, but still used while the page is open
	}
}
