'use client'

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { ROMANIZATION_NAMES } from './romanization';
import type { Romanization } from './romanization';
import { useRomanization } from './RomanizationContext';

const GITHUB = 'https://github.com/AVespaIsNotAMotorcycle/dots-and-circles';

const PAGES: [string, string][] = [
	['/', 'Read a page'],
	['/test-words', 'Test words'],
];

// The site's pages, with the current one marked, the romanization to show
// Manchu in, and the code on GitHub
export default function Header() {
	const pathname = usePathname();
	const [romanization, setRomanization] = useRomanization();

	return (
		<header>
			<nav>
				<ul>
					{PAGES.map(([href, text]) => (
						<li key={href}>
							<Link
								href={href}
								aria-current={pathname === href ? 'page' : undefined}
							>
								{text}
							</Link>
						</li>
					))}
				</ul>
				{/* Together on the right, or on a row of their own on a phone */}
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
			</nav>
		</header>
	);
}
