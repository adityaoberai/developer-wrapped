import { isArchetypeId } from '$lib/content/archetypes';
import { computeScores, rankArchetypes, type Scores } from '$lib/scoring';
import { DB_ID, TABLES } from '$lib/server/appwrite';
import { toAnswerDto } from '$lib/server/dto';
import { parseQuestion, type AnswerDto, type QuestionDto, type QuizQuestion } from '$lib/types';
import { Query, type Models, type TablesDB } from 'node-appwrite';

export class InvalidQuizDataError extends Error {}
export class IncompleteQuizError extends Error {}

export const EXPECTED_QUESTION_COUNT = 8;

export function toQuestionDto(row: Models.DefaultRow): QuestionDto {
	return {
		id: row.$id,
		prompt: row.prompt as string,
		options_json: row.options_json as string,
		weights_json: row.weights_json as string,
		position: row.position as number
	};
}

/** Parse and validate database-authored quiz data before it reaches scoring or resume logic. */
export function parseStoredQuestion(dto: QuestionDto): QuizQuestion {
	let question: QuizQuestion;
	try {
		question = parseQuestion(dto);
	} catch {
		throw new InvalidQuizDataError(`Question ${dto.id} contains invalid JSON.`);
	}

	if (
		!question.prompt ||
		!Number.isInteger(question.position) ||
		!Array.isArray(question.options) ||
		question.options.length === 0 ||
		!question.weights ||
		typeof question.weights !== 'object' ||
		Array.isArray(question.weights)
	) {
		throw new InvalidQuizDataError(`Question ${dto.id} is incomplete.`);
	}

	const optionIds = new Set<string>();
	for (const option of question.options) {
		if (
			!option ||
			typeof option.id !== 'string' ||
			!/^[a-zA-Z0-9._-]{1,64}$/.test(option.id) ||
			typeof option.label !== 'string' ||
			typeof option.emoji !== 'string' ||
			optionIds.has(option.id)
		) {
			throw new InvalidQuizDataError(`Question ${dto.id} contains an invalid option.`);
		}
		optionIds.add(option.id);

		const weights = question.weights[option.id];
		if (
			!weights ||
			typeof weights !== 'object' ||
			Array.isArray(weights) ||
			Object.keys(weights).length === 0
		) {
			throw new InvalidQuizDataError(`Question ${dto.id} is missing option weights.`);
		}
		for (const [archetypeId, points] of Object.entries(weights)) {
			if (
				!isArchetypeId(archetypeId) ||
				typeof points !== 'number' ||
				!Number.isInteger(points) ||
				points < 0 ||
				points > 100
			) {
				throw new InvalidQuizDataError(`Question ${dto.id} contains invalid scoring weights.`);
			}
		}
	}

	return question;
}

export function parseQuestionSet(questions: QuestionDto[]): QuizQuestion[] {
	if (questions.length !== EXPECTED_QUESTION_COUNT) {
		throw new InvalidQuizDataError(
			`Expected ${EXPECTED_QUESTION_COUNT} active questions, found ${questions.length}.`
		);
	}
	const parsed = questions.map(parseStoredQuestion);
	if (new Set(parsed.map((question) => question.position)).size !== parsed.length) {
		throw new InvalidQuizDataError('Active question positions must be unique.');
	}
	return parsed;
}

export async function listActiveQuestions(tablesDB: TablesDB): Promise<QuestionDto[]> {
	const { rows } = await tablesDB.listRows({
		databaseId: DB_ID,
		tableId: TABLES.questions,
		queries: [Query.equal('active', true), Query.orderAsc('position'), Query.limit(100)]
	});
	return rows.map(toQuestionDto);
}

export async function listUserAnswers(tablesDB: TablesDB, userId: string): Promise<AnswerDto[]> {
	const { rows } = await tablesDB.listRows({
		databaseId: DB_ID,
		tableId: TABLES.answers,
		queries: [Query.equal('user_id', userId), Query.limit(100)]
	});
	return rows.map(toAnswerDto);
}

/** Discard legacy/stale answers that no longer match an active question option. */
export function validAnswersFor(questions: QuestionDto[], answers: AnswerDto[]): AnswerDto[] {
	const validOptions = new Map(
		questions.map((dto) => {
			const question = parseStoredQuestion(dto);
			return [question.id, new Set(question.options.map((option) => option.id))] as const;
		})
	);

	const newestByQuestion = new Map<string, AnswerDto>();
	for (const answer of answers) {
		if (!validOptions.get(answer.question_id)?.has(answer.option_id)) continue;
		const current = newestByQuestion.get(answer.question_id);
		const parsedAnsweredAt = Date.parse(answer.answered_at);
		const parsedCurrentAnsweredAt = current
			? Date.parse(current.answered_at)
			: Number.NEGATIVE_INFINITY;
		const answeredAt = Number.isFinite(parsedAnsweredAt)
			? parsedAnsweredAt
			: Number.NEGATIVE_INFINITY;
		const currentAnsweredAt = Number.isFinite(parsedCurrentAnsweredAt)
			? parsedCurrentAnsweredAt
			: Number.NEGATIVE_INFINITY;
		if (
			!current ||
			answeredAt > currentAnsweredAt ||
			(answeredAt === currentAnsweredAt && answer.id > current.id)
		) {
			newestByQuestion.set(answer.question_id, answer);
		}
	}
	return [...newestByQuestion.values()];
}

export function scoreCompletedQuiz(
	questions: QuestionDto[],
	answers: AnswerDto[]
): {
	scores: Scores;
	primary: ReturnType<typeof rankArchetypes>['primary'];
	secondary: ReturnType<typeof rankArchetypes>['secondary'];
} {
	const parsed = parseQuestionSet(questions);
	const selections = new Map(
		validAnswersFor(questions, answers).map((a) => [a.question_id, a.option_id])
	);
	if (!parsed.every((question) => selections.has(question.id))) {
		throw new IncompleteQuizError('Every active question must have a valid answer.');
	}

	const scores = computeScores(parsed, selections);
	return { scores, ...rankArchetypes(scores) };
}
