import { describe, expect, it } from 'vitest';
import { matchesOauthState, resolveOauthRedirectOrigin } from './oauth.server';

describe('matchesOauthState', () => {
	it('returns true for exact matches', () => {
		expect(matchesOauthState('abc', 'abc')).toBe(true);
	});

	it('returns false for mismatches and missing values', () => {
		expect(matchesOauthState('abc', 'abd')).toBe(false);
		expect(matchesOauthState(null, 'abc')).toBe(false);
		expect(matchesOauthState('abc', undefined)).toBe(false);
	});
});

describe('resolveOauthRedirectOrigin', () => {
	it('uses the request url origin when no configured origin is present', () => {
		const url = new URL('http://internal.local/auth/login');
		expect(resolveOauthRedirectOrigin(url)).toBe('http://internal.local');
	});

	it('uses the configured origin when provided', () => {
		const url = new URL('http://internal.local/auth/login');
		expect(resolveOauthRedirectOrigin(url, 'https://app.example.com')).toBe(
			'https://app.example.com'
		);
	});

	it('normalizes a configured origin that includes a path', () => {
		const url = new URL('http://internal.local/auth/login');
		expect(resolveOauthRedirectOrigin(url, 'https://app.example.com/some/path?foo=bar')).toBe(
			'https://app.example.com'
		);
	});

	it('falls back when configured origin is invalid', () => {
		const url = new URL('http://internal.local/auth/login');
		expect(resolveOauthRedirectOrigin(url, 'not a url')).toBe('http://internal.local');
	});

	it('falls back when configured origin uses an unsupported protocol', () => {
		const url = new URL('http://internal.local/auth/login');
		expect(resolveOauthRedirectOrigin(url, 'ftp://app.example.com')).toBe('http://internal.local');
	});
});
