import { DB_ID, getRowOrNull, requireAuth, TABLES } from '$lib/server/appwrite';
import { toAnswerDto } from '$lib/server/dto';
import {
	InvalidQuizDataError,
	listUserAnswers,
	parseStoredQuestion,
	toQuestionDto
} from '$lib/server/quiz';
import { asString, ID_PATTERN } from '$lib/server/validate';
import { error, json } from '@sveltejs/kit';
import { createHash } from 'node:crypto';
import { Permission, Role } from 'node-appwrite';
import type { RequestHandler } from './$types';

/** Load saved answers for quiz resume. Users can only ever read their own. */
export const GET: RequestHandler = async ({ locals, url }) => {
	const { user, tablesDB } = await requireAuth(locals);

	const requested = url.searchParams.get('user_id');
	if (requested && requested !== user.$id) {
		error(403, 'You can only read your own answers.');
	}

	return json(await listUserAnswers(tablesDB, user.$id));
};

/**
 * Save or update one answer immediately when selected.
 * Deterministic row id (userId_questionId) makes saves idempotent, so
 * re-answering a question upserts rather than duplicating.
 */
export const POST: RequestHandler = async ({ locals, request }) => {
	const { user, tablesDB } = await requireAuth(locals);

	const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
	if (body.user_id && body.user_id !== user.$id) {
		error(403, 'You can only save your own answers.');
	}

	const questionId = asString(body.question_id, 36);
	const optionId = asString(body.option_id, 64);
	if (!ID_PATTERN.test(questionId) || !/^[a-zA-Z0-9._-]{1,64}$/.test(optionId)) {
		error(400, 'Invalid question_id or option_id.');
	}

	const questionRow = await getRowOrNull(tablesDB, TABLES.questions, questionId);
	if (!questionRow || questionRow.active !== true) {
		error(400, 'Question is not active.');
	}
	try {
		const question = parseStoredQuestion(toQuestionDto(questionRow));
		if (!question.options.some((option) => option.id === optionId)) {
			error(400, 'Option does not belong to this question.');
		}
	} catch (cause) {
		if (cause instanceof InvalidQuizDataError) error(503, 'Quiz content is temporarily invalid.');
		throw cause;
	}

	const naturalRowId = `${user.$id}_${questionId}`;
	const rowId = ID_PATTERN.test(naturalRowId)
		? naturalRowId
		: `answer_${createHash('sha256').update(naturalRowId).digest('hex').slice(0, 29)}`;

	const row = await tablesDB.upsertRow({
		databaseId: DB_ID,
		tableId: TABLES.answers,
		rowId,
		data: {
			user_id: user.$id,
			question_id: questionId,
			option_id: optionId,
			answered_at: new Date().toISOString()
		},
		permissions: [
			Permission.read(Role.user(user.$id)),
			Permission.update(Role.user(user.$id)),
			Permission.delete(Role.user(user.$id))
		]
	});

	return json(toAnswerDto(row));
};
