import { dev } from '$app/environment';
import { createSessionClient, SESSION_COOKIE } from '$lib/server/appwrite';
import { AppwriteException } from 'node-appwrite';
import type { Handle, HandleServerError } from '@sveltejs/kit';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const PRIVATE_PATHS = new Set(['/welcome', '/quiz', '/reveal']);

function secure(response: Response, url: URL): Response {
	if (!response.headers.has('content-security-policy')) {
		response.headers.set(
			'content-security-policy',
			"base-uri 'none'; frame-ancestors 'none'; object-src 'none'; form-action 'self'"
		);
	}
	response.headers.set(
		'permissions-policy',
		'camera=(), geolocation=(), microphone=(), payment=(), usb=()'
	);
	response.headers.set('referrer-policy', 'strict-origin-when-cross-origin');
	response.headers.set('x-content-type-options', 'nosniff');
	response.headers.set('x-frame-options', 'DENY');
	response.headers.set('x-permitted-cross-domain-policies', 'none');
	if (!dev && url.protocol === 'https:') {
		response.headers.set('strict-transport-security', 'max-age=31536000');
	}
	return response;
}

export const handle: Handle = async ({ event, resolve }) => {
	const origin = event.request.headers.get('origin');
	if (MUTATING_METHODS.has(event.request.method) && origin && origin !== event.url.origin) {
		return secure(
			new Response('Cross-origin request forbidden.', {
				status: 403,
				headers: { 'cache-control': 'private, no-store, max-age=0' }
			}),
			event.url
		);
	}

	const session = event.cookies.get(SESSION_COOKIE) ?? null;
	event.locals.session = session;

	let cached: Awaited<ReturnType<App.Locals['auth']>> | undefined;
	event.locals.auth = async () => {
		if (cached !== undefined) return cached;
		if (!session) {
			cached = null;
			return cached;
		}
		try {
			const { client, account, tablesDB, storage } = createSessionClient(session);
			const userAgent = event.request.headers.get('user-agent');
			if (userAgent) client.setForwardedUserAgent(userAgent.slice(0, 512));
			const user = await account.get();
			cached = { user, account, tablesDB, storage };
		} catch (error) {
			if (error instanceof AppwriteException && error.code === 401) {
				event.cookies.delete(SESSION_COOKIE, { path: '/' });
			}
			cached = null;
		}
		return cached;
	};

	const response = await resolve(event);
	if (
		session ||
		event.url.pathname.startsWith('/auth/') ||
		PRIVATE_PATHS.has(event.url.pathname) ||
		response.status >= 400
	) {
		response.headers.set('cache-control', 'private, no-store, max-age=0');
	}
	secure(response, event.url);
	if (event.url.pathname === '/auth/callback') {
		response.headers.set('referrer-policy', 'no-referrer');
	}
	return response;
};

/** Keep unexpected server failures generic in client-rendered error pages. */
export const handleError: HandleServerError = ({ error, event, status }) => {
	const kind = error instanceof Error ? error.name : 'UnknownError';
	console.error(`[server] ${status} ${event.request.method} ${event.url.pathname} (${kind})`);
	return { message: 'An unexpected error occurred.' };
};
