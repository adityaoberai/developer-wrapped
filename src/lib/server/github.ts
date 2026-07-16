import { PUBLIC_APPWRITE_ENDPOINT, PUBLIC_APPWRITE_PROJECT } from '$env/static/public';
import { Query, type Account, type Models } from 'node-appwrite';

export interface GithubIdentity {
	github_username: string;
	display_name: string;
	avatar_url: string;
}

/**
 * Resolve the user's public GitHub identity from their GitHub OAuth identity.
 * With the token flow (createOAuth2Token + createSession) the session object
 * does not carry the provider access token — it lives on the user's identity,
 * so we look it up via the Identities API. The token is used transiently for
 * one GitHub API call and is never persisted anywhere (see non-functional
 * requirements).
 */
export async function resolveGithubIdentity(
	account: Account,
	user: Models.User<Models.Preferences>
): Promise<GithubIdentity> {
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
		if (!identity) return fallback;

		if (identity.providerAccessToken) {
			const res = await fetch('https://api.github.com/user', {
				headers: {
					Authorization: `Bearer ${identity.providerAccessToken}`,
					Accept: 'application/vnd.github+json',
					'User-Agent': 'developer-wrapped'
				}
			});
			if (res.ok) {
				const gh = (await res.json()) as { login: string; name: string | null; avatar_url: string };
				return {
					github_username: gh.login,
					display_name: gh.name || gh.login,
					avatar_url: gh.avatar_url
				};
			}
		}

		// Token expired or GitHub API unavailable — the numeric provider UID still gives us the avatar.
		if (identity.providerUid) {
			return {
				...fallback,
				avatar_url: `https://avatars.githubusercontent.com/u/${identity.providerUid}?v=4`
			};
		}
	} catch {
		// Users without a GitHub identity (e.g. test users) simply get the fallback identity.
	}
	return fallback;
}

function initialsAvatar(name: string): string {
	return `${PUBLIC_APPWRITE_ENDPOINT}/avatars/initials?name=${encodeURIComponent(name)}&width=192&height=192&project=${PUBLIC_APPWRITE_PROJECT}`;
}
