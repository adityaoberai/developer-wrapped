import { dev } from '$app/environment';
import { createGuestClient } from '$lib/server/appwrite';
import { redirect } from '@sveltejs/kit';
import { randomBytes } from 'node:crypto';
import { OAuthProvider } from 'node-appwrite';
import { OAUTH_STATE_COOKIE, OAUTH_STATE_TTL_SECONDS } from '../oauth.server';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies, url }) => {
	const state = randomBytes(32).toString('base64url');
	cookies.set(OAUTH_STATE_COOKIE, state, {
		path: '/auth/callback',
		httpOnly: true,
		sameSite: 'lax',
		secure: !dev,
		maxAge: OAUTH_STATE_TTL_SECONDS
	});

	const callback = new URL('/auth/callback', url.origin);
	callback.searchParams.set('state', state);
	const failure = new URL(callback);
	failure.searchParams.set('error', 'oauth_failed');

	const { account } = createGuestClient();
	const redirectUrl = await account.createOAuth2Token({
		provider: OAuthProvider.Github,
		success: callback.toString(),
		failure: failure.toString()
	});
	redirect(302, redirectUrl);
};
