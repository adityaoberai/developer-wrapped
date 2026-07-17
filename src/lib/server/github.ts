import { PUBLIC_APPWRITE_ENDPOINT, PUBLIC_APPWRITE_PROJECT } from '$env/static/public';
import { Query, type Account, type Models } from 'node-appwrite';

export interface GithubIdentity {
	github_username: string;
	display_name: string;
	avatar_url: string;
}

export interface GithubAccess {
	identity: GithubIdentity;
	/**
	 * Provider access token, used transiently for GitHub API calls within the
	 * current request and never persisted anywhere (see non-functional
	 * requirements). Null only when the identity is missing or carries no token.
	 */
	accessToken: string | null;
}

/**
 * Resolve the user's public GitHub identity and (transient) access token from
 * their GitHub OAuth identity. With the token flow (createOAuth2Token +
 * createSession) the session object does not carry the provider access token —
 * it lives on the user's identity, so we look it up via the Identities API.
 *
 * Two hard-won rules:
 * - The stored token is returned whenever it exists. Appwrite records a zero
 *   lifetime for GitHub OAuth-app tokens (GitHub sends no expires_in), so the
 *   identity's expiry field is meaningless — GitHub itself is the only
 *   authority on whether the token still works.
 * - Identity enrichment is display-only and must never gate the token. It uses
 *   the GraphQL viewer query (the same endpoint the stats collector needs), so
 *   an unrelated REST outage cannot break the sync flow.
 */
export async function resolveGithubAccess(
	account: Account,
	user: Models.User<Models.Preferences>
): Promise<GithubAccess> {
	const fallback: GithubIdentity = {
		github_username: '',
		display_name: user.name || 'Mystery Developer',
		avatar_url: initialsAvatar(user.name || 'Dev')
	};

	try {
		const { identities } = await account.listIdentities({
			queries: [Query.equal('provider', 'github'), Query.orderDesc('$updatedAt'), Query.limit(1)]
		});
		const identity = identities[0];
		if (!identity) return { identity: fallback, accessToken: null };

		const accessToken = identity.providerAccessToken || null;
		// The numeric provider UID gives a correct avatar even without API access.
		const offline: GithubIdentity = identity.providerUid
			? {
					...fallback,
					avatar_url: `https://avatars.githubusercontent.com/u/${identity.providerUid}?v=4`
				}
			: fallback;

		if (accessToken) {
			const viewer = await fetchViewer(accessToken);
			if (viewer) {
				return {
					identity: {
						github_username: viewer.login,
						display_name: viewer.name || viewer.login,
						avatar_url: viewer.avatarUrl
					},
					accessToken
				};
			}
		}
		return { identity: offline, accessToken };
	} catch {
		// Users without a GitHub identity (e.g. test users) simply get the fallback identity.
	}
	return { identity: fallback, accessToken: null };
}

/** Cheap token-presence check (no GitHub round-trip) for sync-status polling. */
export async function hasGithubToken(account: Account): Promise<boolean> {
	try {
		const { identities } = await account.listIdentities({
			queries: [Query.equal('provider', 'github'), Query.orderDesc('$updatedAt'), Query.limit(1)]
		});
		return Boolean(identities[0]?.providerAccessToken);
	} catch {
		// Assume syncable on a transient Appwrite failure; the inline sync
		// fallback is the authority and reports the real error.
		return true;
	}
}

/** Identity-only variant for callers that never touch the GitHub API. */
export async function resolveGithubIdentity(
	account: Account,
	user: Models.User<Models.Preferences>
): Promise<GithubIdentity> {
	return (await resolveGithubAccess(account, user)).identity;
}

async function fetchViewer(
	accessToken: string
): Promise<{ login: string; name: string | null; avatarUrl: string } | null> {
	try {
		const res = await fetch('https://api.github.com/graphql', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${accessToken}`,
				'Content-Type': 'application/json',
				'User-Agent': 'developer-wrapped'
			},
			body: JSON.stringify({ query: 'query { viewer { login name avatarUrl } }' })
		});
		if (!res.ok) return null;
		const payload = (await res.json()) as {
			data?: { viewer?: { login: string; name: string | null; avatarUrl: string } };
		};
		return payload.data?.viewer ?? null;
	} catch {
		return null;
	}
}

function initialsAvatar(name: string): string {
	return `${PUBLIC_APPWRITE_ENDPOINT}/avatars/initials?name=${encodeURIComponent(name)}&width=192&height=192&project=${PUBLIC_APPWRITE_PROJECT}`;
}
