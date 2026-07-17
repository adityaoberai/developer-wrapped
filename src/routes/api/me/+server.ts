import { getRowOrNull, requireAuth, TABLES } from '$lib/server/appwrite';
import type { ArchetypeId, MeResponse } from '$lib/types';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	const { user, tablesDB } = await requireAuth(locals);

	const getOwnRow = (tableId: string) => getRowOrNull(tablesDB, tableId, user.$id);

	const [profile, result] = await Promise.all([
		getOwnRow(TABLES.profiles),
		getOwnRow(TABLES.results)
	]);

	const body: MeResponse = {
		user: { id: user.$id, name: user.name, email: user.email },
		profile: profile
			? {
					github_username: (profile.github_username as string) ?? '',
					display_name: (profile.display_name as string) ?? '',
					avatar_url: (profile.avatar_url as string) ?? '',
					quiz_completed: Boolean(profile.quiz_completed)
				}
			: null,
		currentResult: result ? { archetype_id: result.archetype_id as ArchetypeId } : null
	};

	return json(body);
};
