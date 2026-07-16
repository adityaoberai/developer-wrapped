import { PUBLIC_APPWRITE_ENDPOINT, PUBLIC_APPWRITE_PROJECT } from '$env/static/public';
import {
	BUCKET_ID,
	DB_ID,
	getRowOrNull,
	isAppwriteNotFound,
	requireAuth,
	TABLES
} from '$lib/server/appwrite';
import { error, json } from '@sveltejs/kit';
import { Permission, Role } from 'node-appwrite';
import { InputFile } from 'node-appwrite/file';
import type { RequestHandler } from './$types';

const MAX_BYTES = 4 * 1024 * 1024;

/**
 * Upload the rendered share-card PNG to Appwrite Storage and link it to the
 * user's result. The card inherits the result's visibility.
 */
export const POST: RequestHandler = async ({ locals, request }) => {
	const { user, tablesDB, storage } = await requireAuth(locals);

	if (!request.headers.get('content-type')?.includes('image/png')) {
		error(415, 'Expected a PNG image.');
	}
	const bytes = await request.arrayBuffer();
	if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) {
		error(413, 'Card image must be between 1 byte and 4 MB.');
	}
	const signature = new Uint8Array(bytes, 0, Math.min(bytes.byteLength, 8));
	if (
		signature.length !== 8 ||
		![0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every(
			(byte, index) => signature[index] === byte
		)
	) {
		error(415, 'Uploaded content is not a valid PNG file.');
	}

	const result = await getRowOrNull(tablesDB, TABLES.results, user.$id);
	if (!result) {
		error(404, 'Finish the quiz before generating a share card.');
	}

	const fileId = user.$id;
	try {
		await storage.deleteFile({ bucketId: BUCKET_ID, fileId });
	} catch (cause) {
		if (!isAppwriteNotFound(cause)) throw cause;
	}
	const file = await storage.createFile({
		bucketId: BUCKET_ID,
		fileId,
		file: InputFile.fromBuffer(Buffer.from(bytes), `wrapped-${result.share_slug}.png`),
		permissions: [
			...(result.is_public
				? [Permission.read(Role.any())]
				: [Permission.read(Role.user(user.$id))]),
			Permission.update(Role.user(user.$id)),
			Permission.delete(Role.user(user.$id))
		]
	});

	await tablesDB.updateRow({
		databaseId: DB_ID,
		tableId: TABLES.results,
		rowId: user.$id,
		data: { card_file_id: file.$id }
	});

	return json({
		file_id: file.$id,
		url: `${PUBLIC_APPWRITE_ENDPOINT}/storage/buckets/${BUCKET_ID}/files/${file.$id}/view?project=${PUBLIC_APPWRITE_PROJECT}`
	});
};
