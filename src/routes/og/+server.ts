import { getArchetype } from '$lib/content/archetypes';
import { createGuestClient, DB_ID, TABLES } from '$lib/server/appwrite';
import { renderOgImage, type OgCard } from '$lib/server/og/render';
import { Query } from 'node-appwrite';
import type { RequestHandler } from './$types';

const DEFAULT_CARD: OgCard = {
	title: 'What kind of developer are you, really?',
	subtitle: 'Find out in eight uncomfortably accurate questions. One dramatic diagnosis.',
	handle: 'wrapped for developers',
	gradient: ['#7C3AED', '#DB2777']
};

/** Dynamic 1200x630 Open Graph image; `?slug=` renders a personalized result card. */
export const GET: RequestHandler = async ({ url }) => {
	let card = DEFAULT_CARD;

	const slug = url.searchParams.get('slug');
	if (slug) {
		try {
			const { tablesDB } = createGuestClient();
			const { rows } = await tablesDB.listRows({
				databaseId: DB_ID,
				tableId: TABLES.results,
				queries: [Query.equal('share_slug', slug), Query.equal('is_public', true), Query.limit(1)]
			});
			const row = rows[0];
			if (row) {
				const archetype = getArchetype(row.archetype_id as string);
				const name =
					(row.display_name as string) || (row.github_username as string) || 'A developer';
				card = {
					title: `${name} is ${archetype.name}`,
					subtitle: `“${archetype.tagline}”`,
					handle: row.github_username ? `@${row.github_username}` : 'developer wrapped',
					gradient: archetype.gradient
				};
			}
		} catch {
			// fall back to the default card
		}
	}

	const png = await renderOgImage(card);
	return new Response(new Uint8Array(png), {
		headers: {
			'content-type': 'image/png',
			'cache-control': 'public, max-age=600, s-maxage=86400'
		}
	});
};
