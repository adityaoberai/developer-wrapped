import {
	BUCKET_ID,
	createGuestClient,
	DB_ID,
	getRowOrNull,
	isAppwriteNotFound,
	requireAuth,
	TABLES
} from '$lib/server/appwrite';
import { toPublicResult } from '$lib/server/dto';
import { ID_PATTERN, SLUG_PATTERN } from '$lib/server/validate';
import { error, json } from '@sveltejs/kit';
import { AppwriteException, Permission, Query, Role, type Storage } from 'node-appwrite';
import type { RequestHandler } from './$types';

/** Load a public result by share slug. No auth required — share links work for anyone. */
export const GET: RequestHandler = async ({ params }) => {
	if (!SLUG_PATTERN.test(params.key)) error(404, 'Result not found.');
	const { tablesDB } = createGuestClient();

	const { rows } = await tablesDB.listRows({
		databaseId: DB_ID,
		tableId: TABLES.results,
		queries: [Query.equal('share_slug', params.key), Query.equal('is_public', true), Query.limit(1)]
	});

	if (rows.length === 0) {
		error(404, 'Result not found.');
	}
	return json(toPublicResult(rows[0]));
};

/** Update result visibility and the linked card's permissions. Owner only; `key` is the row id. */
export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	if (!ID_PATTERN.test(params.key)) error(404, 'Result not found.');
	const { user, tablesDB, storage } = await requireAuth(locals);

	let row;
	try {
		row = await getRowOrNull(tablesDB, TABLES.results, params.key);
	} catch (cause) {
		// Appwrite can report an inaccessible row as 401/403 rather than 404.
		if (cause instanceof AppwriteException && (cause.code === 401 || cause.code === 403)) {
			error(404, 'Result not found.');
		}
		throw cause;
	}
	if (!row || row.user_id !== user.$id) {
		error(row ? 403 : 404, row ? 'Not your result.' : 'Result not found.');
	}

	const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
	if (typeof body.is_public !== 'boolean') {
		error(400, 'is_public must be a boolean.');
	}

	const isPublic = body.is_public;
	const rowPermissions = resultPermissions(user.$id, isPublic);
	const data: Record<string, unknown> = { is_public: isPublic };

	// Revoke public card access before making a result private. When publishing,
	// expose the row first so a public card never points at a private result.
	if (!isPublic) {
		const cardExists = await updateCardVisibility(storage, user.$id, false);
		if (!cardExists) data.card_file_id = '';
	}

	let updated = await tablesDB.updateRow({
		databaseId: DB_ID,
		tableId: TABLES.results,
		rowId: params.key,
		data,
		permissions: rowPermissions
	});

	if (isPublic) {
		const cardExists = await updateCardVisibility(storage, user.$id, true);
		if (!cardExists && updated.card_file_id) {
			updated = await tablesDB.updateRow({
				databaseId: DB_ID,
				tableId: TABLES.results,
				rowId: params.key,
				data: { card_file_id: '' },
				permissions: rowPermissions
			});
		}
	}

	return json({
		id: updated.$id,
		is_public: Boolean(updated.is_public),
		card_file_id: (updated.card_file_id as string) || null,
		updated_at: updated.$updatedAt
	});
};

function resultPermissions(userId: string, isPublic: boolean): string[] {
	return [
		...(isPublic ? [Permission.read(Role.any())] : [Permission.read(Role.user(userId))]),
		Permission.update(Role.user(userId)),
		Permission.delete(Role.user(userId))
	];
}

async function updateCardVisibility(
	storage: Storage,
	userId: string,
	isPublic: boolean
): Promise<boolean> {
	try {
		await storage.updateFile({
			bucketId: BUCKET_ID,
			fileId: userId,
			permissions: [
				...(isPublic ? [Permission.read(Role.any())] : [Permission.read(Role.user(userId))]),
				Permission.update(Role.user(userId)),
				Permission.delete(Role.user(userId))
			]
		});
		return true;
	} catch (cause) {
		if (isAppwriteNotFound(cause)) return false;
		throw cause;
	}
}
