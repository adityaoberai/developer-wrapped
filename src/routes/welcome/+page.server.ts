import { readApiJson, requireArray } from '$lib/server/http';
import { InvalidQuizDataError, validAnswersFor } from '$lib/server/quiz';
import type { AnswerDto, MeResponse, ProfileDto, QuestionDto } from '$lib/types';
import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, fetch }) => {
	const auth = await locals.auth();
	if (!auth) redirect(302, '/');

	// Upsert the profile via the API (fresh GitHub identity on every sign-in),
	// and load quiz state in parallel to decide between start and resume.
	const [profileRes, meRes, questionsRes, answersRes] = await Promise.all([
		fetch('/api/profile', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ user_id: auth.user.$id })
		}),
		fetch('/api/me'),
		fetch('/api/questions'),
		fetch(`/api/answers?user_id=${encodeURIComponent(auth.user.$id)}`)
	]);

	const profile = await readApiJson<ProfileDto>(profileRes, 'profile');
	const me = await readApiJson<MeResponse>(meRes, 'account');
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

	const questionIds = new Set(questions.map((q) => q.id));
	const answeredCount = answers.filter((a) => questionIds.has(a.question_id)).length;

	return {
		profile,
		currentResult: me.currentResult,
		totalQuestions: questions.length,
		answeredCount
	};
};
