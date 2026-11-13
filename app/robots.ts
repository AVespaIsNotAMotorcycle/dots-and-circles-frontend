import type { MetadataRoute } from 'next';

import { SITE_URL } from './site';

// Every page may be crawled; the sitemap lists them
export default function robots(): MetadataRoute.Robots {
	return {
		rules: { userAgent: '*', allow: '/' },
		sitemap: `${SITE_URL}/sitemap.xml`,
	};
}
