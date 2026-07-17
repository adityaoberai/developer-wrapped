import { getArchetype } from '$lib/content/archetypes';
import { createGuestClient, getRowOrNull, TABLES } from '$lib/server/appwrite';
import { renderOgImage, type OgCard } from '$lib/server/og/render';
import { SLUG_PATTERN } from '$lib/server/validate';
import type { SharedMetrics } from '$lib/wrapped/types';
import type { RequestHandler } from './$types';

const DEFAULT_CARD: OgCard = {
	title: 'What kind of developer are you, really?',
	subtitle: 'Your last 12 months on GitHub, turned into an uncomfortably accurate story.',
	handle: 'wrapped for developers',
	gradient: ['#B23016', '#8F2410']
};

/**
 * Dynamic 1200x630 Open Graph image; `?wrapped=` renders a published Wrapped
 * card (sanitized public data only), otherwise the default card.
 */
export const GET: RequestHandler = async ({ url }) => {
	let card = DEFAULT_CARD;

	const wrappedSlug = url.searchParams.get('wrapped');
	if (wrappedSlug && SLUG_PATTERN.test(wrappedSlug)) {
		try {
			const { tablesDB } = createGuestClient();
			const row = await getRowOrNull(tablesDB, TABLES.publicShares, wrappedSlug);
			if (row) {
				const metrics = JSON.parse(row.metrics_json as string) as SharedMetrics;
				const archetype = row.archetype_id ? getArchetype(row.archetype_id as string) : null;
				const name =
					(row.display_name as string) || (row.github_username as string) || 'A developer';
				card = {
					title: `${name}: ${metrics.contributions.toLocaleString('en-US')} contributions`,
					subtitle: `${metrics.activeDays.toLocaleString('en-US')} active days · ${row.period_start} → ${row.period_end}`,
					handle: row.github_username ? `@${row.github_username}` : 'developer wrapped',
					gradient: archetype?.gradient ?? DEFAULT_CARD.gradient
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
