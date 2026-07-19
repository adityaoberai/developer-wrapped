import { timingSafeEqual } from 'node:crypto';

export const OAUTH_STATE_COOKIE = 'dw-oauth-state';
export const OAUTH_STATE_TTL_SECONDS = 10 * 60;

const FORWARDED_HOST_PATTERN = /^\[[0-9a-fA-F:]+\](?::\d{1,5})?$|^[a-zA-Z0-9.-]+(?::\d{1,5})?$/;

function firstHeaderValue(value: string | null): string | null {
	if (!value) return null;
	const first = value.split(',')[0]?.trim();
	return first || null;
}

function resolveForwardedHost(request: Request): string | null {
	const forwardedHost = firstHeaderValue(request.headers.get('x-forwarded-host'));
	if (forwardedHost && FORWARDED_HOST_PATTERN.test(forwardedHost)) return forwardedHost;
	return null;
}

function resolveForwardedProto(request: Request): 'http' | 'https' | null {
	const forwardedProto = firstHeaderValue(request.headers.get('x-forwarded-proto'))?.toLowerCase();
	if (forwardedProto === 'http' || forwardedProto === 'https') return forwardedProto;
	return null;
}

/** Resolve the public origin used in OAuth success/failure redirects. */
export function resolveOauthRedirectOrigin(request: Request, url: URL): string {
	const host = resolveForwardedHost(request);
	if (!host) return url.origin;

	const proto = resolveForwardedProto(request) ?? (url.protocol === 'http:' ? 'http' : 'https');
	return `${proto}://${host}`;
}

/** Constant-time comparison for the browser-bound OAuth state value. */
export function matchesOauthState(received: string | null, expected: string | undefined): boolean {
	if (!received || !expected) return false;
	const receivedBytes = Buffer.from(received);
	const expectedBytes = Buffer.from(expected);
	if (receivedBytes.length !== expectedBytes.length) return false;
	return timingSafeEqual(receivedBytes, expectedBytes);
}
