import { DB_ID, TABLES } from '$lib/server/appwrite';
import type { GithubIdentity } from '$lib/server/github';
import { type Models, Permission, Role, type TablesDB } from 'node-appwrite';

/**
 * Create or update the user's profile row (rowId = userId, so upserts are idempotent).
 * Rows are private: only the owner can read or change their profile.
 */
export async function upsertProfile(
	tablesDB: TablesDB,
	user: Models.User<Models.Preferences>,
	identity: GithubIdentity,
	extra: { quiz_completed?: boolean } = {}
): Promise<Models.DefaultRow> {
	return tablesDB.upsertRow({
		databaseId: DB_ID,
		tableId: TABLES.profiles,
		rowId: user.$id,
		data: {
			user_id: user.$id,
			github_username: identity.github_username,
			display_name: identity.display_name,
			avatar_url: identity.avatar_url,
			...extra
		},
		permissions: [
			Permission.read(Role.user(user.$id)),
			Permission.update(Role.user(user.$id)),
			Permission.delete(Role.user(user.$id))
		]
	});
}
