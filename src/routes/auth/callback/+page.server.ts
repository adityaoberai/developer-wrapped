import { dev } from '$app/environment';
import { createAdminClient, SESSION_COOKIE } from '$lib/server/appwrite';
import { redirect } from '@sveltejs/kit';
import { matchesOauthState, OAUTH_STATE_COOKIE } from '../oauth.server';
import type { PageServerLoad } from './$types';

const USER_ID_PATTERN = /^[a-zA-Z0-9._-]{1,36}$/;

/** Exchange the one-time OAuth token before any callback URL data reaches client JavaScript. */
export const load: PageServerLoad = async ({ cookies, request, setHeaders, url }) => {
	setHeaders({
		'cache-control': 'private, no-store, max-age=0',
		'referrer-policy': 'no-referrer'
	});

	const expectedState = cookies.get(OAUTH_STATE_COOKIE);
	cookies.delete(OAUTH_STATE_COOKIE, { path: '/auth/callback' });

	const state = url.searchParams.get('state');
	const userId = url.searchParams.get('userId');
	const secret = url.searchParams.get('secret');
	if (
		url.searchParams.has('error') ||
		!matchesOauthState(state, expectedState) ||
		!userId ||
		!USER_ID_PATTERN.test(userId) ||
		!secret ||
		secret.length > 4096
	) {
		return { failed: true };
	}

	try {
		// The token exchange must use an API-key client: Appwrite returns an empty
		// session secret to unauthenticated requests, which would set a dead cookie.
		const { client, account } = createAdminClient();
		const userAgent = request.headers.get('user-agent');
		if (userAgent) client.setForwardedUserAgent(userAgent.slice(0, 512));

		const session = await account.createSession({ userId, secret });
		if (!session.secret) return { failed: true };
		cookies.set(SESSION_COOKIE, session.secret, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: !dev,
			expires: new Date(session.expire)
		});
	} catch {
		return { failed: true };
	}

	redirect(303, '/welcome');
};
