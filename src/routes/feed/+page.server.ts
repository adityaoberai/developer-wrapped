import { createGuestClient, DB_ID, TABLES } from '$lib/server/appwrite';
import { isArchetypeId } from '$lib/content/archetypes';
import { SLUG_PATTERN } from '$lib/server/validate';
import type { FeedItem } from '$lib/types';
import type { SharedMetrics } from '$lib/wrapped/types';
import { Query } from 'node-appwrite';
import type { PageServerLoad } from './$types';

/** The feed reads only sanitized, explicitly published public_shares rows. */
export const load: PageServerLoad = async () => {
	const { tablesDB } = createGuestClient();

	let items: FeedItem[] = [];
	try {
		const { rows } = await tablesDB.listRows({
			databaseId: DB_ID,
			tableId: TABLES.publicShares,
			queries: [Query.orderDesc('published_at'), Query.limit(20)]
		});
		items = rows.flatMap((row) => {
			const shareSlug = row.share_slug as string;
			const publishedAt = row.published_at as string;
			if (!SLUG_PATTERN.test(shareSlug) || Number.isNaN(Date.parse(publishedAt))) {
				return [];
			}
			let contributions: number;
			try {
				contributions = (JSON.parse(row.metrics_json as string) as SharedMetrics).contributions;
			} catch {
				return [];
			}
			const archetypeId = (row.archetype_id as string) ?? '';
			return [
				{
					share_slug: shareSlug,
					display_name: (row.display_name as string) ?? '',
					github_username: (row.github_username as string) ?? '',
					avatar_url: (row.avatar_url as string) ?? '',
					archetype_id: isArchetypeId(archetypeId) ? archetypeId : null,
					contributions,
					published_at: publishedAt
				}
			];
		});
	} catch {
		// Databases hiccup — the page still renders with an empty feed.
	}

	return { items };
};
