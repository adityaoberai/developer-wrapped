import { loadRecentShares } from '$lib/server/feed';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const [auth, recentlyWrapped] = await Promise.all([locals.auth(), loadRecentShares(6)]);
	return {
		signedIn: auth !== null,
		name: auth?.user.name ?? null,
		recentlyWrapped
	};
};
