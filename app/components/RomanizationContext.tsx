'use client'

import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import type { Romanization } from './romanization';

const KEY = 'dots-and-circles:romanization';

// The romanization Manchu is shown in across the site, Abkai or Norman, and
// how to change it
const RomanizationContext = createContext<[Romanization, (romanization: Romanization) => void]>(
	['abkai', () => {}],
);

// Holds the user's romanization, kept in this browser. Abkai until the
// page has loaded what was kept, so the server's HTML and the first render
// agree.
export function RomanizationProvider({ children }: { children: ReactNode }) {
	const [romanization, setRomanization] = useState<Romanization>('abkai');
	useEffect(() => {
		try {
			const kept = localStorage.getItem(KEY);
			// eslint-disable-next-line react-hooks/set-state-in-effect -- read once kept storage is available
			if (kept === 'norman' || kept === 'abkai') setRomanization(kept);
		} catch {
			// Nothing kept, so Abkai
		}
	}, []);
	const choose = (next: Romanization) => {
		setRomanization(next);
		try {
			localStorage.setItem(KEY, next);
		} catch {
			// Not kept, but used while the page is open
		}
	};
	return (
		<RomanizationContext.Provider value={[romanization, choose]}>
			{children}
		</RomanizationContext.Provider>
	);
}

export const useRomanization = () => useContext(RomanizationContext);
