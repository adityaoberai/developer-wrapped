import { timingSafeEqual } from 'node:crypto';

export const OAUTH_STATE_COOKIE = 'dw-oauth-state';
export const OAUTH_STATE_TTL_SECONDS = 10 * 60;

function normalizedConfiguredOrigin(configuredOrigin: string | undefined): string | null {
	if (!configuredOrigin) return null;
	try {
		const parsed = new URL(configuredOrigin);
		if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
		return parsed.origin;
	} catch {
		return null;
	}
}

/** Resolve the public origin used in OAuth success/failure redirects. */
export function resolveOauthRedirectOrigin(url: URL, configuredOrigin?: string): string {
	return normalizedConfiguredOrigin(configuredOrigin) ?? url.origin;
}

/** Constant-time comparison for the browser-bound OAuth state value. */
export function matchesOauthState(received: string | null, expected: string | undefined): boolean {
	if (!received || !expected) return false;
	const receivedBytes = Buffer.from(received);
	const expectedBytes = Buffer.from(expected);
	if (receivedBytes.length !== expectedBytes.length) return false;
	return timingSafeEqual(receivedBytes, expectedBytes);
}
