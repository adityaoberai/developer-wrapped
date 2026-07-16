import type { RawGithubStats, WrappedPeriod } from '$lib/wrapped/types';

export type GithubSyncErrorKind = 'rate-limited' | 'unauthorized' | 'unavailable';

export class GithubSyncError extends Error {
	constructor(
		public readonly kind: GithubSyncErrorKind,
		message: string
	) {
		super(message);
	}
}

const STATS_QUERY = `
query WrappedStats($from: DateTime!, $to: DateTime!) {
  viewer {
    login
    createdAt
    repositoriesContributedTo(
      contributionTypes: [COMMIT, PULL_REQUEST, ISSUE, PULL_REQUEST_REVIEW]
    ) {
      totalCount
    }
    contributionsCollection(from: $from, to: $to) {
      totalCommitContributions
      totalPullRequestContributions
      totalPullRequestReviewContributions
      totalIssueContributions
      restrictedContributionsCount
      contributionCalendar {
        weeks {
          contributionDays {
            date
            contributionCount
          }
        }
      }
      commitContributionsByRepository(maxRepositories: 25) {
        repository {
          name
          isPrivate
          primaryLanguage {
            name
          }
        }
        contributions {
          totalCount
        }
      }
    }
  }
}`;

interface StatsResponse {
	data?: {
		viewer: {
			login: string;
			createdAt: string;
			repositoriesContributedTo: { totalCount: number };
			contributionsCollection: {
				totalCommitContributions: number;
				totalPullRequestContributions: number;
				totalPullRequestReviewContributions: number;
				totalIssueContributions: number;
				restrictedContributionsCount: number;
				contributionCalendar: {
					weeks: { contributionDays: { date: string; contributionCount: number }[] }[];
				};
				commitContributionsByRepository: {
					repository: {
						name: string;
						isPrivate: boolean;
						primaryLanguage: { name: string } | null;
					};
					contributions: { totalCount: number };
				}[];
			};
		};
	};
	errors?: { type?: string; message?: string }[];
}

/**
 * Collect aggregate contribution data for the period via GitHub GraphQL.
 * Only aggregates leave this function: no raw events, no code, and private
 * repository names are filtered out before anything is returned.
 */
export async function fetchGithubStats(
	accessToken: string,
	period: WrappedPeriod
): Promise<RawGithubStats> {
	let res: Response;
	try {
		res = await fetch('https://api.github.com/graphql', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${accessToken}`,
				'Content-Type': 'application/json',
				'User-Agent': 'developer-wrapped'
			},
			body: JSON.stringify({
				query: STATS_QUERY,
				variables: {
					from: `${period.start}T00:00:00Z`,
					to: `${period.end}T23:59:59Z`
				}
			})
		});
	} catch {
		throw new GithubSyncError('unavailable', 'GitHub could not be reached.');
	}

	if (res.status === 401) {
		throw new GithubSyncError('unauthorized', 'The GitHub authorization has expired.');
	}
	if (res.status === 403 || res.status === 429) {
		throw new GithubSyncError('rate-limited', 'GitHub rate limit reached. Try again shortly.');
	}
	if (!res.ok) {
		throw new GithubSyncError('unavailable', `GitHub returned ${res.status}.`);
	}

	const payload = (await res.json().catch(() => null)) as StatsResponse | null;
	if (payload?.errors?.some((e) => e.type === 'RATE_LIMITED')) {
		throw new GithubSyncError('rate-limited', 'GitHub rate limit reached. Try again shortly.');
	}
	const viewer = payload?.data?.viewer;
	if (!viewer) {
		throw new GithubSyncError('unavailable', 'GitHub returned an unexpected response.');
	}

	const collection = viewer.contributionsCollection;
	return {
		login: viewer.login,
		accountCreatedAt: viewer.createdAt,
		days: collection.contributionCalendar.weeks.flatMap((week) =>
			week.contributionDays.map((day) => ({
				date: day.date,
				contributionCount: day.contributionCount
			}))
		),
		totalCommitContributions: collection.totalCommitContributions,
		totalPullRequestContributions: collection.totalPullRequestContributions,
		totalPullRequestReviewContributions: collection.totalPullRequestReviewContributions,
		totalIssueContributions: collection.totalIssueContributions,
		restrictedContributionsCount: collection.restrictedContributionsCount,
		publicCommitRepos: collection.commitContributionsByRepository
			.filter((entry) => !entry.repository.isPrivate)
			.map((entry) => ({
				name: entry.repository.name,
				language: entry.repository.primaryLanguage?.name ?? null,
				commits: entry.contributions.totalCount
			})),
		repositoriesContributedTo: viewer.repositoriesContributedTo.totalCount
	};
}
