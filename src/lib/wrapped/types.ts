/**
 * Wrapped report data shapes. `METRIC_VERSION`/`STORY_VERSION` are stored with
 * every report so old snapshots can be re-rendered or migrated deliberately.
 */

export const METRIC_VERSION = 1;
export const STORY_VERSION = 1;

/** One day of the GitHub contribution calendar. */
export interface RawContributionDay {
	date: string; // YYYY-MM-DD
	contributionCount: number;
}

/** Aggregate GitHub activity as collected (already free of raw events/code). */
export interface RawGithubStats {
	login: string;
	accountCreatedAt: string; // ISO datetime
	days: RawContributionDay[];
	totalCommitContributions: number;
	totalPullRequestContributions: number;
	totalPullRequestReviewContributions: number;
	totalIssueContributions: number;
	restrictedContributionsCount: number;
	/** Public repositories committed to during the period, with primary language. */
	publicCommitRepos: { name: string; language: string | null; commits: number }[];
	repositoriesContributedTo: number;
}

export interface WrappedPeriod {
	start: string; // YYYY-MM-DD inclusive
	end: string; // YYYY-MM-DD inclusive
	days: number;
	key: string; // e.g. "12m-2026-07-17"
}

export interface WrappedMetrics {
	version: number;
	period: WrappedPeriod;
	/** 'partial' when the GitHub account is younger than the reporting period. */
	coverage: 'full' | 'partial';
	totals: {
		contributions: number;
		commits: number;
		pullRequests: number;
		reviews: number;
		issues: number;
		/** Private contributions counted but never itemized. */
		restricted: number;
	};
	activeDays: number;
	busiestMonth: { month: string; label: string; contributions: number } | null;
	busiestWeekday: { weekday: number; name: string; contributions: number } | null;
	longestStreak: { days: number; start: string; end: string } | null;
	peakDay: { date: string; contributions: number } | null;
	repositories: {
		contributedTo: number;
		topPublic: { name: string; language: string | null; commits: number }[];
	};
	/** Language mix across public repos committed to (count = repos, share = 0..1). */
	languages: { name: string; repos: number; share: number }[];
}

/** Private report row shape as served by GET /api/wrapped. */
export interface WrappedReportDto {
	user_id: string;
	period_start: string;
	period_end: string;
	period_key: string;
	synced_at: string;
	coverage: 'full' | 'partial';
	metrics: WrappedMetrics;
	metric_version: number;
	story_version: number;
	is_published: boolean;
	share_slug: string | null;
}

/** Sanitized metric subset that a published share exposes. Nothing else leaves the report. */
export interface SharedMetrics {
	contributions: number;
	activeDays: number;
	pullRequests: number;
	reviews: number;
	issues: number;
	longestStreak: number;
	busiestMonthLabel: string | null;
	peakDayCount: number | null;
	topLanguages: string[];
}

/** Public share row shape (anonymous reads). */
export interface PublicShareDto {
	share_slug: string;
	display_name: string;
	github_username: string;
	avatar_url: string;
	period_start: string;
	period_end: string;
	metrics: SharedMetrics;
	archetype_id: string | null;
	quiz_archetype_id: string | null;
	published_at: string;
}
