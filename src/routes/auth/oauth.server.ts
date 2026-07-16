import { timingSafeEqual } from 'node:crypto';

export const OAUTH_STATE_COOKIE = 'dw-oauth-state';
export const OAUTH_STATE_TTL_SECONDS = 10 * 60;

/** Constant-time comparison for the browser-bound OAuth state value. */
export function matchesOauthState(received: string | null, expected: string | undefined): boolean {
	if (!received || !expected) return false;
	const receivedBytes = Buffer.from(received);
	const expectedBytes = Buffer.from(expected);
	if (receivedBytes.length !== expectedBytes.length) return false;
	return timingSafeEqual(receivedBytes, expectedBytes);
}
