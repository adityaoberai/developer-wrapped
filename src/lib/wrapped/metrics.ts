import {
	METRIC_VERSION,
	type RawGithubStats,
	type SharedMetrics,
	type WrappedMetrics,
	type WrappedPeriod
} from './types';

const DAY_MS = 86_400_000;
const WEEKDAY_NAMES = [
	'Sunday',
	'Monday',
	'Tuesday',
	'Wednesday',
	'Thursday',
	'Friday',
	'Saturday'
] as const;
const MONTH_NAMES = [
	'January',
	'February',
	'March',
	'April',
	'May',
	'June',
	'July',
	'August',
	'September',
	'October',
	'November',
	'December'
] as const;

function toUtcDate(isoDay: string): Date {
	return new Date(`${isoDay}T00:00:00Z`);
}

function toIsoDay(date: Date): string {
	return date.toISOString().slice(0, 10);
}

/**
 * Rolling 12-month reporting window ending on `today` (inclusive).
 * GitHub's contributionsCollection accepts at most a one-year span, so the
 * window starts the day after the same date one year earlier.
 */
export function rollingYearPeriod(today: Date): WrappedPeriod {
	const end = toIsoDay(today);
	const startDate = new Date(today.getTime());
	startDate.setUTCFullYear(startDate.getUTCFullYear() - 1);
	startDate.setUTCDate(startDate.getUTCDate() + 1);
	const start = toIsoDay(startDate);
	const days = Math.round((toUtcDate(end).getTime() - toUtcDate(start).getTime()) / DAY_MS) + 1;
	return { start, end, days, key: `12m-${end}` };
}

/** Deterministic aggregate metrics for an exact period. Handles empty accounts. */
export function computeMetrics(raw: RawGithubStats, period: WrappedPeriod): WrappedMetrics {
	// The calendar API returns whole weeks; keep only days inside the period.
	const days = raw.days
		.filter((day) => day.date >= period.start && day.date <= period.end)
		.slice()
		.sort((a, b) => (a.date < b.date ? -1 : 1));

	const contributions = days.reduce((sum, day) => sum + day.contributionCount, 0);
	const activeDays = days.filter((day) => day.contributionCount > 0).length;

	// Busiest calendar month (ties resolved to the earliest month for determinism).
	const byMonth = new Map<string, number>();
	for (const day of days) {
		const month = day.date.slice(0, 7);
		byMonth.set(month, (byMonth.get(month) ?? 0) + day.contributionCount);
	}
	let busiestMonth: WrappedMetrics['busiestMonth'] = null;
	for (const [month, count] of [...byMonth.entries()].sort()) {
		if (count > 0 && (!busiestMonth || count > busiestMonth.contributions)) {
			const monthIndex = Number(month.slice(5, 7)) - 1;
			busiestMonth = {
				month,
				label: `${MONTH_NAMES[monthIndex]} ${month.slice(0, 4)}`,
				contributions: count
			};
		}
	}

	// Busiest weekday (ties resolved to the earliest weekday, Sunday first).
	const byWeekday = new Array<number>(7).fill(0);
	for (const day of days) {
		byWeekday[toUtcDate(day.date).getUTCDay()] += day.contributionCount;
	}
	let busiestWeekday: WrappedMetrics['busiestWeekday'] = null;
	for (let weekday = 0; weekday < 7; weekday++) {
		if (
			byWeekday[weekday] > 0 &&
			(!busiestWeekday || byWeekday[weekday] > busiestWeekday.contributions)
		) {
			busiestWeekday = {
				weekday,
				name: WEEKDAY_NAMES[weekday],
				contributions: byWeekday[weekday]
			};
		}
	}

	// Longest run of consecutive active days. Calendar gaps break a streak.
	let longestStreak: WrappedMetrics['longestStreak'] = null;
	let runStart: string | null = null;
	let previousActive: string | null = null;
	let runLength = 0;
	for (const day of days) {
		if (day.contributionCount <= 0) {
			runStart = null;
			previousActive = null;
			runLength = 0;
			continue;
		}
		const contiguous =
			previousActive !== null &&
			toUtcDate(day.date).getTime() - toUtcDate(previousActive).getTime() === DAY_MS;
		if (!contiguous) {
			runStart = day.date;
			runLength = 0;
		}
		runLength += 1;
		previousActive = day.date;
		if (!longestStreak || runLength > longestStreak.days) {
			longestStreak = { days: runLength, start: runStart!, end: day.date };
		}
	}

	// Peak day (ties resolved to the earliest date).
	let peakDay: WrappedMetrics['peakDay'] = null;
	for (const day of days) {
		if (day.contributionCount > 0 && (!peakDay || day.contributionCount > peakDay.contributions)) {
			peakDay = { date: day.date, contributions: day.contributionCount };
		}
	}

	// Public language mix, weighted by repository count.
	const languageRepos = new Map<string, number>();
	for (const repo of raw.publicCommitRepos) {
		if (!repo.language) continue;
		languageRepos.set(repo.language, (languageRepos.get(repo.language) ?? 0) + 1);
	}
	const languageTotal = [...languageRepos.values()].reduce((sum, count) => sum + count, 0);
	const languages = [...languageRepos.entries()]
		.sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
		.slice(0, 6)
		.map(([name, repos]) => ({
			name,
			repos,
			share: languageTotal > 0 ? repos / languageTotal : 0
		}));

	const topPublic = raw.publicCommitRepos
		.slice()
		.sort((a, b) => b.commits - a.commits || (a.name < b.name ? -1 : 1))
		.slice(0, 5)
		.map((repo) => ({ name: repo.name, language: repo.language, commits: repo.commits }));

	const accountCreated = raw.accountCreatedAt.slice(0, 10);
	const coverage: WrappedMetrics['coverage'] = accountCreated > period.start ? 'partial' : 'full';

	return {
		version: METRIC_VERSION,
		period,
		coverage,
		totals: {
			contributions,
			commits: raw.totalCommitContributions,
			pullRequests: raw.totalPullRequestContributions,
			reviews: raw.totalPullRequestReviewContributions,
			issues: raw.totalIssueContributions,
			restricted: raw.restrictedContributionsCount
		},
		activeDays,
		busiestMonth,
		busiestWeekday,
		longestStreak,
		peakDay,
		repositories: {
			contributedTo: raw.repositoriesContributedTo,
			topPublic
		},
		languages
	};
}

/** The only projection a published share may contain. Everything else stays private. */
export function toSharedMetrics(metrics: WrappedMetrics): SharedMetrics {
	return {
		contributions: metrics.totals.contributions,
		activeDays: metrics.activeDays,
		pullRequests: metrics.totals.pullRequests,
		reviews: metrics.totals.reviews,
		issues: metrics.totals.issues,
		longestStreak: metrics.longestStreak?.days ?? 0,
		busiestMonthLabel: metrics.busiestMonth?.label ?? null,
		peakDayCount: metrics.peakDay?.contributions ?? null,
		topLanguages: metrics.languages.slice(0, 3).map((language) => language.name)
	};
}

/** The single most distinctive fact for a share card, with its source metric. */
export function headlineMetric(metrics: WrappedMetrics): { value: string; label: string } {
	if (metrics.longestStreak && metrics.longestStreak.days >= 7) {
		return {
			value: `${metrics.longestStreak.days}`,
			label: metrics.longestStreak.days === 1 ? 'day streak' : 'day streak'
		};
	}
	if (metrics.totals.contributions > 0) {
		return { value: metrics.totals.contributions.toLocaleString('en-US'), label: 'contributions' };
	}
	return { value: `${metrics.activeDays}`, label: 'active days' };
}
