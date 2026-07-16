import { SESSION_COOKIE } from '$lib/server/appwrite';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, cookies }) => {
	const auth = await locals.auth();
	if (auth) {
		await auth.account.deleteSession({ sessionId: 'current' }).catch(() => {});
	}
	cookies.delete(SESSION_COOKIE, { path: '/' });
	return json({ ok: true });
};
