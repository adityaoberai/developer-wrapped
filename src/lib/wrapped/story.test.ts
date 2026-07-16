import { describe, expect, it } from 'vitest';
import { computeMetrics } from './metrics';
import { deriveGithubArchetype, pickObservation } from './story';
import type { RawGithubStats, WrappedPeriod } from './types';

const PERIOD: WrappedPeriod = {
	start: '2025-07-18',
	end: '2026-07-17',
	days: 365,
	key: '12m-2026-07-17'
};

function metricsFrom(overrides: Partial<RawGithubStats> = {}) {
	return computeMetrics(
		{
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
		},
		PERIOD
	);
}

describe('deriveGithubArchetype', () => {
	it('crowns the reviewer as Pipeline Whisperer with the metric as evidence', () => {
		const verdict = deriveGithubArchetype(
			metricsFrom({
				totalPullRequestReviewContributions: 42,
				totalPullRequestContributions: 30
			})
		);
		expect(verdict.archetypeId).toBe('pipelineWhisperer');
		expect(verdict.reason.source).toContain('reviews=42');
	});

	it('flags Friday-heavy committers as Production Cowboy', () => {
		// 2025-07-25 is a Friday; concentrate the year there.
		const verdict = deriveGithubArchetype(
			metricsFrom({
				days: [
					{ date: '2025-07-25', contributionCount: 8 },
					{ date: '2025-07-26', contributionCount: 1 }
				],
				totalCommitContributions: 120
			})
		);
		expect(verdict.archetypeId).toBe('productionCowboy');
		expect(verdict.reason.source).toContain('busiest_weekday=Friday');
	});

	it('calls out issue collectors as Tab Hoarder', () => {
		const verdict = deriveGithubArchetype(
			metricsFrom({ totalIssueContributions: 25, totalPullRequestContributions: 4 })
		);
		expect(verdict.archetypeId).toBe('tabHoarder');
		expect(verdict.reason.source).toContain('issues=25');
	});

	it('falls back to Vibe Coder when no pattern dominates', () => {
		const verdict = deriveGithubArchetype(metricsFrom());
		expect(verdict.archetypeId).toBe('vibeCoder');
		expect(verdict.reason.source).toBeTruthy();
	});

	it('is deterministic: identical metrics, identical verdict', () => {
		const input = metricsFrom({ totalCommitContributions: 77, totalPullRequestContributions: 3 });
		expect(deriveGithubArchetype(input)).toEqual(deriveGithubArchetype(input));
	});
});

describe('pickObservation', () => {
	it('handles a completely empty year', () => {
		const observation = pickObservation(metricsFrom());
		expect(observation.text).toContain('Zero contributions');
		expect(observation.source).toContain('contributions=0');
	});

	it('surfaces a single-day spike with the day as evidence', () => {
		const observation = pickObservation(
			metricsFrom({
				days: [
					{ date: '2025-11-11', contributionCount: 60 },
					{ date: '2025-11-13', contributionCount: 40 }
				]
			})
		);
		expect(observation.text).toContain('2025-11-11');
		expect(observation.source).toContain('peak_day=2025-11-11:60');
	});

	it('always returns a claim with a source metric', () => {
		const observation = pickObservation(
			metricsFrom({ days: [{ date: '2025-10-01', contributionCount: 2 }] })
		);
		expect(observation.text.length).toBeGreaterThan(0);
		expect(observation.source.length).toBeGreaterThan(0);
	});
});
