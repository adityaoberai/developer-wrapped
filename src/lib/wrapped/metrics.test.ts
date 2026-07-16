import { describe, expect, it } from 'vitest';
import { computeMetrics, headlineMetric, rollingYearPeriod, toSharedMetrics } from './metrics';
import type { RawGithubStats, WrappedPeriod } from './types';

const PERIOD: WrappedPeriod = {
	start: '2025-07-18',
	end: '2026-07-17',
	days: 365,
	key: '12m-2026-07-17'
};

function raw(overrides: Partial<RawGithubStats> = {}): RawGithubStats {
	return {
		login: 'octocat',
		accountCreatedAt: '2015-01-01T00:00:00Z',
		days: [],
		totalCommitContributions: 0,
		totalPullRequestContributions: 0,
		totalPullRequestReviewContributions: 0,
		totalIssueContributions: 0,
		restrictedContributionsCount: 0,
		publicCommitRepos: [],
		repositoriesContributedTo: 0,
		...overrides
	};
}

describe('rollingYearPeriod', () => {
	it('spans exactly the trailing year, inclusive of today', () => {
		const period = rollingYearPeriod(new Date('2026-07-17T09:30:00Z'));
		expect(period.start).toBe('2025-07-18');
		expect(period.end).toBe('2026-07-17');
		expect(period.days).toBe(365);
		expect(period.key).toBe('12m-2026-07-17');
	});

	it('never exceeds the GitHub one-year maximum across leap days', () => {
		const period = rollingYearPeriod(new Date('2024-02-29T12:00:00Z'));
		expect(period.days).toBeLessThanOrEqual(366);
		expect(period.end).toBe('2024-02-29');
	});
});

describe('computeMetrics', () => {
	it('returns zeros and nulls for an empty account', () => {
		const metrics = computeMetrics(raw(), PERIOD);
		expect(metrics.totals.contributions).toBe(0);
		expect(metrics.activeDays).toBe(0);
		expect(metrics.busiestMonth).toBeNull();
		expect(metrics.busiestWeekday).toBeNull();
		expect(metrics.longestStreak).toBeNull();
		expect(metrics.peakDay).toBeNull();
		expect(metrics.languages).toEqual([]);
	});

	it('ignores calendar days outside the exact period boundaries', () => {
		const metrics = computeMetrics(
			raw({
				days: [
					{ date: '2025-07-17', contributionCount: 99 }, // day before the window
					{ date: '2025-07-18', contributionCount: 1 }, // first day in
					{ date: '2026-07-17', contributionCount: 2 }, // last day in
					{ date: '2026-07-18', contributionCount: 99 } // day after the window
				]
			}),
			PERIOD
		);
		expect(metrics.totals.contributions).toBe(3);
		expect(metrics.activeDays).toBe(2);
	});

	it('computes streaks across month boundaries and breaks them on gaps', () => {
		const metrics = computeMetrics(
			raw({
				days: [
					{ date: '2025-08-30', contributionCount: 1 },
					{ date: '2025-08-31', contributionCount: 4 },
					{ date: '2025-09-01', contributionCount: 2 },
					{ date: '2025-09-02', contributionCount: 0 }, // zero-day breaks the run
					{ date: '2025-09-03', contributionCount: 5 },
					// calendar gap (no 2025-09-04 entry) also breaks a run
					{ date: '2025-09-05', contributionCount: 5 }
				]
			}),
			PERIOD
		);
		expect(metrics.longestStreak).toEqual({ days: 3, start: '2025-08-30', end: '2025-09-01' });
	});

	it('resolves peak-day and busiest-month ties to the earliest occurrence', () => {
		const metrics = computeMetrics(
			raw({
				days: [
					{ date: '2025-08-04', contributionCount: 7 }, // Monday
					{ date: '2025-09-08', contributionCount: 7 } // Monday, same count
				]
			}),
			PERIOD
		);
		expect(metrics.peakDay).toEqual({ date: '2025-08-04', contributions: 7 });
		expect(metrics.busiestMonth?.month).toBe('2025-08');
		expect(metrics.busiestMonth?.label).toBe('August 2025');
		expect(metrics.busiestWeekday?.name).toBe('Monday');
	});

	it('marks coverage partial when the account is younger than the period', () => {
		const metrics = computeMetrics(raw({ accountCreatedAt: '2026-01-05T00:00:00Z' }), PERIOD);
		expect(metrics.coverage).toBe('partial');
		expect(computeMetrics(raw(), PERIOD).coverage).toBe('full');
	});

	it('builds a language mix weighted by public repo count', () => {
		const metrics = computeMetrics(
			raw({
				publicCommitRepos: [
					{ name: 'a', language: 'TypeScript', commits: 10 },
					{ name: 'b', language: 'TypeScript', commits: 5 },
					{ name: 'c', language: 'Rust', commits: 50 },
					{ name: 'd', language: null, commits: 3 }
				]
			}),
			PERIOD
		);
		expect(metrics.languages[0]).toEqual({ name: 'TypeScript', repos: 2, share: 2 / 3 });
		expect(metrics.languages[1]).toEqual({ name: 'Rust', repos: 1, share: 1 / 3 });
	});

	it('is deterministic for identical input', () => {
		const input = raw({
			days: [
				{ date: '2025-10-01', contributionCount: 3 },
				{ date: '2025-10-02', contributionCount: 1 }
			],
			totalCommitContributions: 4
		});
		expect(computeMetrics(input, PERIOD)).toEqual(computeMetrics(input, PERIOD));
	});
});

describe('toSharedMetrics', () => {
	it('exposes exactly the sanitized public field set', () => {
		const shared = toSharedMetrics(computeMetrics(raw(), PERIOD));
		expect(Object.keys(shared).sort()).toEqual([
			'activeDays',
			'busiestMonthLabel',
			'contributions',
			'issues',
			'longestStreak',
			'peakDayCount',
			'pullRequests',
			'reviews',
			'topLanguages'
		]);
	});

	it('never includes repository names', () => {
		const metrics = computeMetrics(
			raw({ publicCommitRepos: [{ name: 'secret-project', language: 'Go', commits: 9 }] }),
			PERIOD
		);
		expect(JSON.stringify(toSharedMetrics(metrics))).not.toContain('secret-project');
	});
});

describe('headlineMetric', () => {
	it('prefers a week-plus streak, then contributions, then active days', () => {
		const streaky = computeMetrics(
			raw({
				days: Array.from({ length: 9 }, (_, i) => ({
					date: `2025-09-0${i + 1}`,
					contributionCount: 1
				}))
			}),
			PERIOD
		);
		expect(headlineMetric(streaky)).toEqual({ value: '9', label: 'day streak' });

		const busy = computeMetrics(
			raw({ days: [{ date: '2025-09-01', contributionCount: 1234 }] }),
			PERIOD
		);
		expect(headlineMetric(busy)).toEqual({ value: '1,234', label: 'contributions' });

		const empty = computeMetrics(raw(), PERIOD);
		expect(headlineMetric(empty)).toEqual({ value: '0', label: 'active days' });
	});
});
