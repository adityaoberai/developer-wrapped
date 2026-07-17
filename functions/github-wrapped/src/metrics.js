/**
 * Deterministic metric computation — JS port of src/lib/wrapped/metrics.ts.
 * Keep METRIC_VERSION/STORY_VERSION in lockstep with src/lib/wrapped/types.ts;
 * the app's tests (src/lib/wrapped/metrics.test.ts) define the contract.
 */

export const METRIC_VERSION = 1;
export const STORY_VERSION = 1;

const DAY_MS = 86_400_000;
const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
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
  'December',
];

function toUtcDate(isoDay) {
  return new Date(`${isoDay}T00:00:00Z`);
}

function toIsoDay(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Rolling 12-month reporting window ending on `today` (inclusive).
 * GitHub's contributionsCollection accepts at most a one-year span, so the
 * window starts the day after the same date one year earlier.
 */
export function rollingYearPeriod(today) {
  const end = toIsoDay(today);
  const startDate = new Date(today.getTime());
  startDate.setUTCFullYear(startDate.getUTCFullYear() - 1);
  startDate.setUTCDate(startDate.getUTCDate() + 1);
  const start = toIsoDay(startDate);
  const days =
    Math.round(
      (toUtcDate(end).getTime() - toUtcDate(start).getTime()) / DAY_MS
    ) + 1;
  return { start, end, days, key: `12m-${end}` };
}

/** Deterministic aggregate metrics for an exact period. Handles empty accounts. */
export function computeMetrics(raw, period) {
  // The calendar API returns whole weeks; keep only days inside the period.
  const days = raw.days
    .filter((day) => day.date >= period.start && day.date <= period.end)
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  const contributions = days.reduce(
    (sum, day) => sum + day.contributionCount,
    0
  );
  const activeDays = days.filter((day) => day.contributionCount > 0).length;

  // Busiest calendar month (ties resolved to the earliest month for determinism).
  const byMonth = new Map();
  for (const day of days) {
    const month = day.date.slice(0, 7);
    byMonth.set(month, (byMonth.get(month) ?? 0) + day.contributionCount);
  }
  let busiestMonth = null;
  for (const [month, count] of [...byMonth.entries()].sort()) {
    if (count > 0 && (!busiestMonth || count > busiestMonth.contributions)) {
      const monthIndex = Number(month.slice(5, 7)) - 1;
      busiestMonth = {
        month,
        label: `${MONTH_NAMES[monthIndex]} ${month.slice(0, 4)}`,
        contributions: count,
      };
    }
  }

  // Busiest weekday (ties resolved to the earliest weekday, Sunday first).
  const byWeekday = new Array(7).fill(0);
  for (const day of days) {
    byWeekday[toUtcDate(day.date).getUTCDay()] += day.contributionCount;
  }
  let busiestWeekday = null;
  for (let weekday = 0; weekday < 7; weekday++) {
    if (
      byWeekday[weekday] > 0 &&
      (!busiestWeekday || byWeekday[weekday] > busiestWeekday.contributions)
    ) {
      busiestWeekday = {
        weekday,
        name: WEEKDAY_NAMES[weekday],
        contributions: byWeekday[weekday],
      };
    }
  }

  // Longest run of consecutive active days. Calendar gaps break a streak.
  let longestStreak = null;
  let runStart = null;
  let previousActive = null;
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
      toUtcDate(day.date).getTime() - toUtcDate(previousActive).getTime() ===
        DAY_MS;
    if (!contiguous) {
      runStart = day.date;
      runLength = 0;
    }
    runLength += 1;
    previousActive = day.date;
    if (!longestStreak || runLength > longestStreak.days) {
      longestStreak = { days: runLength, start: runStart, end: day.date };
    }
  }

  // Peak day (ties resolved to the earliest date).
  let peakDay = null;
  for (const day of days) {
    if (
      day.contributionCount > 0 &&
      (!peakDay || day.contributionCount > peakDay.contributions)
    ) {
      peakDay = { date: day.date, contributions: day.contributionCount };
    }
  }

  // Public language mix, weighted by repository count.
  const languageRepos = new Map();
  for (const repo of raw.publicCommitRepos) {
    if (!repo.language) continue;
    languageRepos.set(
      repo.language,
      (languageRepos.get(repo.language) ?? 0) + 1
    );
  }
  const languageTotal = [...languageRepos.values()].reduce(
    (sum, count) => sum + count,
    0
  );
  const languages = [...languageRepos.entries()]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, 6)
    .map(([name, repos]) => ({
      name,
      repos,
      share: languageTotal > 0 ? repos / languageTotal : 0,
    }));

  const topPublic = raw.publicCommitRepos
    .slice()
    .sort((a, b) => b.commits - a.commits || (a.name < b.name ? -1 : 1))
    .slice(0, 5)
    .map((repo) => ({
      name: repo.name,
      language: repo.language,
      commits: repo.commits,
    }));

  const accountCreated = raw.accountCreatedAt.slice(0, 10);
  const coverage = accountCreated > period.start ? 'partial' : 'full';

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
      restricted: raw.restrictedContributionsCount,
    },
    activeDays,
    busiestMonth,
    busiestWeekday,
    longestStreak,
    peakDay,
    repositories: {
      contributedTo: raw.repositoriesContributedTo,
      topPublic,
    },
    languages,
  };
}
