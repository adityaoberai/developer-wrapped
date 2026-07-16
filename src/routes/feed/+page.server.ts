import { createGuestClient, DB_ID, TABLES } from '$lib/server/appwrite';
import { isArchetypeId } from '$lib/content/archetypes';
import { SLUG_PATTERN } from '$lib/server/validate';
import type { FeedItem } from '$lib/types';
import { Query } from 'node-appwrite';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const { tablesDB } = createGuestClient();

	let items: FeedItem[] = [];
	try {
		const { rows } = await tablesDB.listRows({
			databaseId: DB_ID,
			tableId: TABLES.results,
			queries: [Query.equal('is_public', true), Query.orderDesc('completed_at'), Query.limit(20)]
		});
		items = rows.flatMap((row) => {
			const shareSlug = row.share_slug as string;
			const archetypeId = row.archetype_id as string;
			const completedAt = row.completed_at as string;
			if (
				!SLUG_PATTERN.test(shareSlug) ||
				!isArchetypeId(archetypeId) ||
				Number.isNaN(Date.parse(completedAt))
			) {
				return [];
			}
			return [
				{
					share_slug: shareSlug,
					display_name: (row.display_name as string) ?? '',
					github_username: (row.github_username as string) ?? '',
					avatar_url: (row.avatar_url as string) ?? '',
					archetype_id: archetypeId,
					completed_at: completedAt
				}
			];
		});
	} catch {
		// Databases hiccup — the page still renders with an empty feed.
	}

	return { items };
};
