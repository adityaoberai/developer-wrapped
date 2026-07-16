import { archetypes, isArchetypeId } from '$lib/content/archetypes';
import type { ArchetypeId, QuizQuestion } from '$lib/types';

export type Scores = Record<ArchetypeId, number>;

/**
 * Sum archetype points across the user's selections.
 * Weights come from the questions table, so scoring is fully client-computable.
 */
export function computeScores(questions: QuizQuestion[], selections: Map<string, string>): Scores {
	const scores = Object.fromEntries(archetypes.map((a) => [a.id, 0])) as Scores;
	for (const question of questions) {
		const optionId = selections.get(question.id);
		if (!optionId) continue;
		for (const [archetypeId, points] of Object.entries(question.weights[optionId] ?? {})) {
			if (isArchetypeId(archetypeId) && typeof points === 'number' && Number.isFinite(points)) {
				scores[archetypeId] += points;
			}
		}
	}
	return scores;
}

/**
 * Deterministic ranking: highest score first; ties broken by the archetype's
 * fixed priority (lower number wins). Same answers always yield the same result.
 */
export function rankArchetypes(scores: Scores): { primary: ArchetypeId; secondary: ArchetypeId } {
	const ranked = [...archetypes].sort(
		(a, b) => scores[b.id] - scores[a.id] || a.priority - b.priority
	);
	return { primary: ranked[0].id, secondary: ranked[1].id };
}
