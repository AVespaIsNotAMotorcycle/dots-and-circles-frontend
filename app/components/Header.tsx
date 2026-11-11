'use client'

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const GITHUB = 'https://github.com/AVespaIsNotAMotorcycle/dots-and-circles';

const PAGES: [string, string][] = [
	['/', 'Read a page'],
	['/test-words', 'Test words'],
];

// The site's pages, with the current one marked, and the code on GitHub
export default function Header() {
	const pathname = usePathname();

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
					<li className="github">
						<a href={GITHUB} target="_blank" rel="noreferrer">GitHub</a>
					</li>
				</ul>
			</nav>
		</header>
	);
}
