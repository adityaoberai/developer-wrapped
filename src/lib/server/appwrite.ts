import { PUBLIC_APPWRITE_ENDPOINT, PUBLIC_APPWRITE_PROJECT } from '$env/static/public';
import { env } from '$env/dynamic/private';
import { error } from '@sveltejs/kit';
import { Account, AppwriteException, Client, type Models, Storage, TablesDB } from 'node-appwrite';

export const DB_ID = 'wrapped';
export const TABLES = {
	profiles: 'profiles',
	questions: 'questions',
	answers: 'answers',
	results: 'results',
	wrappedReports: 'wrapped_reports',
	publicShares: 'public_shares'
} as const;
export const BUCKET_ID = 'share-cards';
export const SESSION_COOKIE = 'dw-session';

function baseClient(): Client {
	return new Client().setEndpoint(PUBLIC_APPWRITE_ENDPOINT).setProject(PUBLIC_APPWRITE_PROJECT);
}

/** Unauthenticated client — OAuth token creation and public (read("any")) data only. */
export function createGuestClient() {
	const client = baseClient();
	return { client, account: new Account(client), tablesDB: new TablesDB(client) };
}

/**
 * API-key client — required for the OAuth token → session exchange (Appwrite
 * only returns the session secret to API-key requests) and for all writes to
 * the `wrapped_reports`/`public_shares` tables, which deliberately grant
 * clients no create/update permission so every write passes server validation.
 * Needs an API key with the `sessions.write`, `rows.read` and `rows.write` scopes.
 */
export function createAdminClient() {
	if (!env.APPWRITE_API_KEY) {
		throw new Error('APPWRITE_API_KEY is not set — required for the OAuth session exchange.');
	}
	const client = baseClient().setKey(env.APPWRITE_API_KEY);
	return { client, account: new Account(client), tablesDB: new TablesDB(client) };
}

/** Resolve the authenticated request context or fail with 401. */
export async function requireAuth(locals: App.Locals) {
	const auth = await locals.auth();
	if (!auth) error(401, 'Sign in with GitHub to continue.');
	return auth;
}

/** Client acting as the signed-in user; Appwrite enforces row/file permissions. */
export function createSessionClient(session: string) {
	const client = baseClient().setSession(session);
	return {
		client,
		account: new Account(client),
		tablesDB: new TablesDB(client),
		storage: new Storage(client)
	};
}

/** Appwrite uses 404 for a missing row; other failures must not be mistaken for absence. */
export async function getRowOrNull(
	tablesDB: TablesDB,
	tableId: string,
	rowId: string
): Promise<Models.DefaultRow | null> {
	try {
		return await tablesDB.getRow({ databaseId: DB_ID, tableId, rowId });
	} catch (cause) {
		if (cause instanceof AppwriteException && cause.code === 404) return null;
		throw cause;
	}
}

export function isAppwriteNotFound(cause: unknown): boolean {
	return cause instanceof AppwriteException && cause.code === 404;
}
