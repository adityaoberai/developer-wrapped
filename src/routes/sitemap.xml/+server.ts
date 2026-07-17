import { createGuestClient, DB_ID, TABLES } from '$lib/server/appwrite';
import { SLUG_PATTERN } from '$lib/server/validate';
import { Query } from 'node-appwrite';
import type { RequestHandler } from './$types';

type SitemapEntry = { path: string; lastmod?: string };

function xml(value: string): string {
	const entities: Record<string, string> = {
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&apos;'
	};
	return value.replace(/[&<>"']/g, (character) => entities[character]);
}

/** Public static routes plus the most recent published Wrapped pages. */
export const GET: RequestHandler = async ({ url }) => {
	const entries: SitemapEntry[] = ['/', '/archetypes', '/feed'].map((path) => ({ path }));

	try {
		const { tablesDB } = createGuestClient();
		const shares = await tablesDB.listRows({
			databaseId: DB_ID,
			tableId: TABLES.publicShares,
			queries: [
				Query.orderDesc('published_at'),
				Query.limit(100),
				Query.select(['share_slug', 'published_at'])
			]
		});

		for (const row of shares.rows) {
			const slug = row.share_slug;
			if (typeof slug !== 'string' || !SLUG_PATTERN.test(slug)) continue;
			const publishedAt = typeof row.published_at === 'string' ? Date.parse(row.published_at) : NaN;
			entries.push({
				path: `/w/${encodeURIComponent(slug)}`,
				lastmod: Number.isNaN(publishedAt) ? undefined : new Date(publishedAt).toISOString()
			});
		}
	} catch {
		// Dynamic results are additive; static routes are always available.
	}

	const urls = entries
		.map(
			({ path, lastmod }) =>
				`\t<url><loc>${xml(`${url.origin}${path}`)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`
		)
		.join('\n');

	const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

	return new Response(body, {
		headers: {
			'content-type': 'application/xml; charset=utf-8',
			'cache-control': 'public, max-age=600, s-maxage=3600, stale-while-revalidate=86400',
			vary: 'Host'
		}
	});
};
