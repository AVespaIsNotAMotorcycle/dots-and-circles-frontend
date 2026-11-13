import type { MetadataRoute } from 'next';

import { SITE_URL } from './site';

// The site's pages, for search engines
export default function sitemap(): MetadataRoute.Sitemap {
	return [
		{ url: SITE_URL, changeFrequency: 'monthly', priority: 1 },
		{ url: `${SITE_URL}/test-words`, changeFrequency: 'monthly', priority: 0.5 },
		{ url: `${SITE_URL}/about`, changeFrequency: 'monthly', priority: 0.5 },
	];
}
