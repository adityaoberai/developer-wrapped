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
	it('uses the request url origin when no forwarded host is present', () => {
		const request = new Request('http://internal.local/auth/login');
		const url = new URL('http://internal.local/auth/login');
		expect(resolveOauthRedirectOrigin(request, url)).toBe('http://internal.local');
	});

	it('prefers forwarded host and protocol when provided', () => {
		const request = new Request('http://internal.local/auth/login', {
			headers: {
				'x-forwarded-host': 'app.example.com',
				'x-forwarded-proto': 'https'
			}
		});
		const url = new URL('http://internal.local/auth/login');
		expect(resolveOauthRedirectOrigin(request, url)).toBe('https://app.example.com');
	});

	it('uses the first forwarded values when multiple are present', () => {
		const request = new Request('http://internal.local/auth/login', {
			headers: {
				'x-forwarded-host': 'app.example.com, internal.local',
				'x-forwarded-proto': 'https, http'
			}
		});
		const url = new URL('http://internal.local/auth/login');
		expect(resolveOauthRedirectOrigin(request, url)).toBe('https://app.example.com');
	});

	it('falls back when forwarded host is invalid', () => {
		const request = new Request('http://internal.local/auth/login', {
			headers: {
				'x-forwarded-host': 'bad/host',
				'x-forwarded-proto': 'https'
			}
		});
		const url = new URL('http://internal.local/auth/login');
		expect(resolveOauthRedirectOrigin(request, url)).toBe('http://internal.local');
	});
});
