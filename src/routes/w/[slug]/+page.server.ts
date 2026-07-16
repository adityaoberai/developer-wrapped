import { createGuestClient, getRowOrNull, TABLES } from '$lib/server/appwrite';
import { toPublicShareDto } from '$lib/server/wrapped/reports';
import { SLUG_PATTERN } from '$lib/server/validate';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * Published Wrapped edition. Always read through the unauthenticated client so
 * this page can only ever surface sanitized public_shares data.
 */
export const load: PageServerLoad = async ({ params }) => {
	if (!SLUG_PATTERN.test(params.slug)) {
		error(404, 'This Wrapped does not exist or was unpublished.');
	}
	const { tablesDB } = createGuestClient();
	const row = await getRowOrNull(tablesDB, TABLES.publicShares, params.slug);
	if (!row) {
		error(404, 'This Wrapped does not exist or was unpublished.');
	}
	return { share: toPublicShareDto(row) };
};
