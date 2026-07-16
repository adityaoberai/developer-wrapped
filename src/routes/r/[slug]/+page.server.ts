import { createGuestClient, DB_ID, TABLES } from '$lib/server/appwrite';
import { toPublicResult } from '$lib/server/dto';
import { SLUG_PATTERN } from '$lib/server/validate';
import { error } from '@sveltejs/kit';
import { Query } from 'node-appwrite';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!SLUG_PATTERN.test(params.slug)) error(404, 'This result does not exist or is private.');
	const auth = await locals.auth();
	// The owner's session client can read their own private row; guests only see public rows.
	const tablesDB = auth ? auth.tablesDB : createGuestClient().tablesDB;

	const { rows } = await tablesDB.listRows({
		databaseId: DB_ID,
		tableId: TABLES.results,
		queries: [Query.equal('share_slug', params.slug), Query.limit(1)]
	});

	const row = rows[0];
	const isOwner = row !== undefined && auth !== null && row.user_id === auth.user.$id;
	if (!row || (!row.is_public && !isOwner)) {
		error(404, 'This result does not exist or is private.');
	}

	return {
		result: toPublicResult(row),
		isOwner,
		resultId: isOwner ? row.$id : null
	};
};
