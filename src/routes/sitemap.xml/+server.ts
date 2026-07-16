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

/** Public static routes plus the 100 most recent public result pages. */
export const GET: RequestHandler = async ({ url }) => {
	const entries: SitemapEntry[] = ['/', '/archetypes', '/feed'].map((path) => ({ path }));

	try {
		const { tablesDB } = createGuestClient();
		const { rows } = await tablesDB.listRows({
			databaseId: DB_ID,
			tableId: TABLES.results,
			queries: [
				Query.equal('is_public', true),
				Query.orderDesc('completed_at'),
				Query.limit(100),
				Query.select(['share_slug', 'completed_at'])
			]
		});

		for (const row of rows) {
			const slug = row.share_slug;
			if (typeof slug !== 'string' || !SLUG_PATTERN.test(slug)) continue;
			const completedAt = typeof row.completed_at === 'string' ? Date.parse(row.completed_at) : NaN;
			entries.push({
				path: `/r/${encodeURIComponent(slug)}`,
				lastmod: Number.isNaN(completedAt) ? undefined : new Date(completedAt).toISOString()
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
