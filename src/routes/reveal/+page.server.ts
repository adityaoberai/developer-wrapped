import { readApiJson, requireArray } from '$lib/server/http';
import { InvalidQuizDataError, validAnswersFor } from '$lib/server/quiz';
import type { AnswerDto, QuestionDto } from '$lib/types';
import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, fetch }) => {
	const auth = await locals.auth();
	if (!auth) redirect(302, '/');

	const [questionsRes, answersRes] = await Promise.all([
		fetch('/api/questions'),
		fetch(`/api/answers?user_id=${encodeURIComponent(auth.user.$id)}`)
	]);
	const questions = requireArray<QuestionDto>(
		await readApiJson(questionsRes, 'quiz questions'),
		'quiz questions'
	);
	const savedAnswers = requireArray<AnswerDto>(
		await readApiJson(answersRes, 'saved answers'),
		'saved answers'
	);
	let answers: AnswerDto[];
	try {
		answers = validAnswersFor(questions, savedAnswers);
	} catch (cause) {
		if (cause instanceof InvalidQuizDataError) error(503, 'Quiz content is temporarily invalid.');
		throw cause;
	}

	const answered = new Set(answers.map((a) => a.question_id));
	if (!questions.every((q) => answered.has(q.id))) {
		redirect(302, '/quiz');
	}

	return { userId: auth.user.$id, questions, answers };
};
