import { requireAuth } from '$lib/server/appwrite';
import { InvalidQuizDataError, listActiveQuestions, parseQuestionSet } from '$lib/server/quiz';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	const { tablesDB } = await requireAuth(locals);

	const questions = await listActiveQuestions(tablesDB);
	try {
		parseQuestionSet(questions);
	} catch (cause) {
		if (cause instanceof InvalidQuizDataError) error(503, 'Quiz content is temporarily invalid.');
		throw cause;
	}

	return json(questions);
};
