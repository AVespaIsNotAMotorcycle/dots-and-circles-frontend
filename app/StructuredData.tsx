import { SITE_DESCRIPTION, SITE_URL } from './site';

// The site described for search engines (schema.org JSON-LD): a free web
// application for reading Manchu, by its author
const DATA = {
	'@context': 'https://schema.org',
	'@type': 'WebApplication',
	name: 'Dots and Circles',
	alternateName: 'Dots and Circles: Manchu OCR',
	url: SITE_URL,
	description: SITE_DESCRIPTION,
	applicationCategory: 'ReferenceApplication',
	operatingSystem: 'Any',
	browserRequirements: 'Requires JavaScript',
	inLanguage: 'en',
	isAccessibleForFree: true,
	offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
	keywords: 'Manchu, OCR, Manchu script, transliteration, Abkai, Norman, Möllendorff',
	author: {
		'@type': 'Person',
		name: 'Sasha Madden Ebersole',
		url: 'https://sasha-m-ebersole.com/',
	},
};

export default function StructuredData() {
	return (
		<script
			type="application/ld+json"
			// < escaped, as the Next.js docs advise, so nothing in it can close
			// the script
			dangerouslySetInnerHTML={{ __html: JSON.stringify(DATA).replace(/</g, '\\u003c') }}
		/>
	);
}
