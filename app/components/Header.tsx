'use client'

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRef, useState } from 'react';

import { ROMANIZATION_NAMES } from './romanization';
import type { Romanization } from './romanization';
import { useRomanization } from './RomanizationContext';

const GITHUB = 'https://github.com/AVespaIsNotAMotorcycle/dots-and-circles';

const PAGES: [string, string][] = [
	['/', 'Read a page'],
	['/test-words', 'Test words'],
	['/about', 'About'],
];

// The site's pages, with the current one marked, the romanization to show
// Manchu in, and the code on GitHub. On a small screen they're in a menu,
// under a bar with the current page's name and a button to open it.
export default function Header() {
	const pathname = usePathname();
	const [romanization, setRomanization] = useRomanization();
	// The page the menu was opened on, so going to another page closes it
	const [openOn, setOpenOn] = useState<string>();
	const open = openOn === pathname;
	const menuButton = useRef<HTMLButtonElement>(null);
	const current = PAGES.find(([href]) => href === pathname)?.[1];

	return (
		<header
			className={open ? 'open' : undefined}
			onKeyDown={(event) => {
				if (event.key !== 'Escape' || !open) return;
				setOpenOn(undefined);
				menuButton.current?.focus();
			}}
		>
			<nav aria-label="Site">
				<div className="bar">
					<span className="current">{current ?? 'Dots and Circles'}</span>
					<button
						ref={menuButton}
						type="button"
						className="menuButton"
						aria-expanded={open}
						aria-controls="site-menu"
						aria-label="Menu"
						onClick={() => { setOpenOn(open ? undefined : pathname); }}
					>
						<span aria-hidden="true" />
						<span aria-hidden="true" />
						<span aria-hidden="true" />
					</button>
				</div>
				<div id="site-menu" className="menu">
					<ul>
						{PAGES.map(([href, text]) => (
							<li key={href}>
								<Link
									href={href}
									aria-current={pathname === href ? 'page' : undefined}
									onClick={() => { setOpenOn(undefined); }}
								>
									{text}
								</Link>
							</li>
						))}
					</ul>
					{/* Together on the right, or under the pages in the menu */}
					<div className="tools">
						<div className="romanization" role="group" aria-label="Romanization">
							{(Object.keys(ROMANIZATION_NAMES) as Romanization[]).map((one) => (
								<button
									key={one}
									type="button"
									aria-pressed={romanization === one}
									onClick={() => { setRomanization(one); }}
								>
									{ROMANIZATION_NAMES[one]}
								</button>
							))}
						</div>
						{/* In a span, so its room for the underline doesn't make the row taller */}
						<span>
							<a href={GITHUB} target="_blank" rel="noreferrer">GitHub</a>
						</span>
					</div>
				</div>
			</nav>
		</header>
	);
}
