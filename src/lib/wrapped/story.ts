import type { ArchetypeId } from '$lib/types';
import type { WrappedMetrics } from './types';

export interface EvidenceClaim {
	text: string;
	/** Human-readable pointer at the stored metric backing the claim. */
	source: string;
}

export interface GithubVerdict {
	archetypeId: ArchetypeId;
	reason: EvidenceClaim;
}

const CONFIG_LANGUAGES = new Set(['Shell', 'Vim Script', 'Lua', 'Nix', 'Dotenv', 'Emacs Lisp']);

/**
 * Deterministic, evidence-backed archetype from real activity. Rules are
 * evaluated in a fixed order; the first match wins, so the same metrics always
 * produce the same verdict, and every verdict carries its source metric.
 */
export function deriveGithubArchetype(metrics: WrappedMetrics): GithubVerdict {
	const { totals } = metrics;

	if (totals.reviews >= 10 && totals.reviews >= totals.pullRequests) {
		return {
			archetypeId: 'pipelineWhisperer',
			reason: {
				text: `You reviewed ${totals.reviews.toLocaleString('en-US')} pull requests — as many as (or more than) you opened. The process IS the product.`,
				source: `reviews=${totals.reviews}, pull_requests=${totals.pullRequests}`
			}
		};
	}

	if (
		metrics.peakDay &&
		totals.contributions >= 20 &&
		metrics.peakDay.contributions >= Math.max(10, Math.ceil(totals.contributions * 0.1))
	) {
		return {
			archetypeId: 'ductTapeAlchemist',
			reason: {
				text: `${metrics.peakDay.contributions} contributions landed on a single day (${metrics.peakDay.date}). That was not a calm day.`,
				source: `peak_day=${metrics.peakDay.date}:${metrics.peakDay.contributions}, total=${totals.contributions}`
			}
		};
	}

	if (metrics.busiestWeekday?.name === 'Friday' && totals.commits >= 50) {
		return {
			archetypeId: 'productionCowboy',
			reason: {
				text: `Friday is your busiest day — ${metrics.busiestWeekday.contributions.toLocaleString('en-US')} contributions. Bold. Very bold.`,
				source: `busiest_weekday=Friday:${metrics.busiestWeekday.contributions}, commits=${totals.commits}`
			}
		};
	}

	if (totals.issues >= 10 && totals.issues > totals.pullRequests) {
		return {
			archetypeId: 'tabHoarder',
			reason: {
				text: `${totals.issues.toLocaleString('en-US')} issues filed versus ${totals.pullRequests.toLocaleString('en-US')} pull requests. You collect open questions like browser tabs.`,
				source: `issues=${totals.issues}, pull_requests=${totals.pullRequests}`
			}
		};
	}

	if (
		metrics.languages.length > 0 &&
		CONFIG_LANGUAGES.has(metrics.languages[0].name) &&
		totals.commits >= 10
	) {
		return {
			archetypeId: 'darkModeMonk',
			reason: {
				text: `Your top public language is ${metrics.languages[0].name}. The dotfiles are thriving; the product roadmap sends its regards.`,
				source: `top_language=${metrics.languages[0].name} (${metrics.languages[0].repos} repos)`
			}
		};
	}

	if (metrics.repositories.contributedTo >= 12 && totals.contributions >= 100) {
		return {
			archetypeId: 'astronautArchitect',
			reason: {
				text: `You touched ${metrics.repositories.contributedTo} repositories this year. That is not a project, that is a constellation.`,
				source: `repositories_contributed_to=${metrics.repositories.contributedTo}`
			}
		};
	}

	if (totals.pullRequests >= 1 && totals.commits >= Math.max(30, totals.pullRequests * 12)) {
		return {
			archetypeId: 'refactorPoet',
			reason: {
				text: `${totals.commits.toLocaleString('en-US')} commits distilled into ${totals.pullRequests.toLocaleString('en-US')} pull requests — roughly ${Math.round(totals.commits / totals.pullRequests)} commits of polish per PR.`,
				source: `commits=${totals.commits}, pull_requests=${totals.pullRequests}`
			}
		};
	}

	return {
		archetypeId: 'vibeCoder',
		reason: {
			text: `${totals.contributions.toLocaleString('en-US')} contributions across ${metrics.activeDays} active days, spread evenly across everything. No dominant pattern detected — suspiciously smooth.`,
			source: `contributions=${totals.contributions}, active_days=${metrics.activeDays}`
		}
	};
}

/**
 * One unexpected, evidence-backed observation for the story's roast slide.
 * Rules are ordered by how surprising the fact is; first match wins.
 */
export function pickObservation(metrics: WrappedMetrics): EvidenceClaim {
	const { totals } = metrics;

	if (totals.contributions === 0) {
		return {
			text: 'Zero contributions in the whole period. Either you have achieved perfect work-life balance or this is your reconnaissance account.',
			source: `contributions=0 over ${metrics.period.days} days`
		};
	}

	if (
		metrics.peakDay &&
		metrics.peakDay.contributions >= Math.max(10, Math.ceil(totals.contributions * 0.08))
	) {
		const percent = Math.round((metrics.peakDay.contributions / totals.contributions) * 100);
		return {
			text: `${percent}% of your entire year happened on ${metrics.peakDay.date}. We hope whatever broke that day has apologized.`,
			source: `peak_day=${metrics.peakDay.date}:${metrics.peakDay.contributions} of ${totals.contributions}`
		};
	}

	if (metrics.longestStreak && metrics.longestStreak.days >= 14) {
		return {
			text: `A ${metrics.longestStreak.days}-day contribution streak (${metrics.longestStreak.start} → ${metrics.longestStreak.end}). At some point that stopped being discipline and became a hostage situation.`,
			source: `longest_streak=${metrics.longestStreak.days}d`
		};
	}

	if (
		metrics.busiestWeekday &&
		(metrics.busiestWeekday.weekday === 0 || metrics.busiestWeekday.weekday === 6)
	) {
		return {
			text: `Your busiest day of the week is ${metrics.busiestWeekday.name}. The weekend is a social construct; the pipeline is forever.`,
			source: `busiest_weekday=${metrics.busiestWeekday.name}:${metrics.busiestWeekday.contributions}`
		};
	}

	if (totals.restricted > totals.contributions) {
		return {
			text: `More of your work is private (${totals.restricted.toLocaleString('en-US')} contributions) than public. Mysterious. We respect it. We counted it anyway — as a number, nothing else.`,
			source: `restricted=${totals.restricted}, public_calendar=${totals.contributions}`
		};
	}

	if (metrics.activeDays > 0 && metrics.activeDays < metrics.period.days * 0.15) {
		return {
			text: `You shipped on just ${metrics.activeDays} of ${metrics.period.days} days — but still racked up ${totals.contributions.toLocaleString('en-US')} contributions. Efficiency? Or chaos in short bursts?`,
			source: `active_days=${metrics.activeDays}/${metrics.period.days}`
		};
	}

	return {
		text: `${totals.contributions.toLocaleString('en-US')} contributions across ${metrics.activeDays} active days. Steady, consistent, unnervingly well-adjusted.`,
		source: `contributions=${totals.contributions}, active_days=${metrics.activeDays}`
	};
}

/** Short label for the reporting period, shown on covers and cards. */
export function periodLabel(start: string, end: string): string {
	return `${start} → ${end}`;
}
