import { dev } from '$app/environment';
import { createGuestClient } from '$lib/server/appwrite';
import { redirect } from '@sveltejs/kit';
import { randomBytes } from 'node:crypto';
import { AppwriteException, OAuthProvider } from 'node-appwrite';
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
	// Minimum viable scope: read:user grants public profile + own aggregate
	// contribution data. No repo access, no code, ever.
	let redirectUrl: string;
	try {
		redirectUrl = await account.createOAuth2Token({
			provider: OAuthProvider.Github,
			success: callback.toString(),
			failure: failure.toString(),
			scopes: ['read:user']
		});
	} catch (cause) {
		// createOAuth2Token makes a real request to Appwrite and throws on any
		// non-redirect response (provider disabled, redirect origin not a trusted
		// platform, wrong endpoint/project). handleError() drops the message, so log
		// the real Appwrite status/type/message here before it becomes a generic 500.
		const detail =
			cause instanceof AppwriteException
				? `Appwrite ${cause.code} (${cause.type || 'unknown'}): ${cause.message}`
				: cause instanceof Error
					? cause.message
					: String(cause);
		console.error(`[auth/login] OAuth token request failed — ${detail}`);
		throw cause;
	}
	redirect(302, redirectUrl);
};
