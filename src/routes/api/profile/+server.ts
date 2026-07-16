import { requireAuth } from '$lib/server/appwrite';
import { toProfileDto } from '$lib/server/dto';
import { resolveGithubIdentity } from '$lib/server/github';
import { upsertProfile } from '$lib/server/profile';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Create or upsert the public profile after GitHub OAuth completes.
 * Identity fields are resolved server-side from the OAuth session so a client
 * can never claim someone else's GitHub username or avatar.
 */
export const POST: RequestHandler = async ({ locals, request }) => {
	const { user, account, tablesDB } = await requireAuth(locals);

	const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
	if (body.user_id && body.user_id !== user.$id) {
		error(403, 'You can only manage your own profile.');
	}

	const identity = await resolveGithubIdentity(account, user);
	const row = await upsertProfile(tablesDB, user, identity);

	return json(toProfileDto(row));
};
