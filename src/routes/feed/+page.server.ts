import { loadRecentShares } from '$lib/server/feed';
import type { PageServerLoad } from './$types';

/** The feed reads only sanitized, explicitly published public_shares rows. */
export const load: PageServerLoad = async () => {
	return { items: await loadRecentShares(20) };
};
