import {
	BUCKET_ID,
	DB_ID,
	getRowOrNull,
	isAppwriteNotFound,
	requireAuth,
	TABLES
} from '$lib/server/appwrite';
import { toResultDto } from '$lib/server/dto';
import { resolveGithubIdentity } from '$lib/server/github';
import { upsertProfile } from '$lib/server/profile';
import {
	IncompleteQuizError,
	InvalidQuizDataError,
	listActiveQuestions,
	listUserAnswers,
	scoreCompletedQuiz
} from '$lib/server/quiz';
import { asString, SLUG_PATTERN } from '$lib/server/validate';
import { error, json } from '@sveltejs/kit';
import { randomBytes } from 'node:crypto';
import { Permission, Role } from 'node-appwrite';
import type { RequestHandler } from './$types';

/**
 * Persist the completed quiz result after verifying the client-side score against
 * the user's saved answers. The server-calculated score is the source of truth.
 * One result row per user (rowId = userId); retakes update it in place and
 * keep the original share slug so existing share links never break.
 */
export const POST: RequestHandler = async ({ locals, request }) => {
	const { user, account, tablesDB, storage } = await requireAuth(locals);

	const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
	if (body.user_id && body.user_id !== user.$id) {
		error(403, 'You can only save your own result.');
	}

	const archetypeId = asString(body.archetype_id, 64);
	const secondaryId = asString(body.secondary_archetype_id, 64);
	if (!archetypeId || !secondaryId) {
		error(400, 'Both archetype ids are required.');
	}

	const [questions, answers, existing] = await Promise.all([
		listActiveQuestions(tablesDB),
		listUserAnswers(tablesDB, user.$id),
		getRowOrNull(tablesDB, TABLES.results, user.$id)
	]);

	let scored: ReturnType<typeof scoreCompletedQuiz>;
	try {
		scored = scoreCompletedQuiz(questions, answers);
	} catch (cause) {
		if (cause instanceof IncompleteQuizError) {
			error(409, 'Complete every active question before saving a result.');
		}
		if (cause instanceof InvalidQuizDataError) {
			error(503, 'Quiz content is temporarily invalid.');
		}
		throw cause;
	}

	if (archetypeId !== scored.primary || secondaryId !== scored.secondary) {
		error(409, 'Submitted result does not match the saved answers. Retry from the quiz.');
	}
	const scoresJson = JSON.stringify(scored.scores);

	const bodySlug = asString(body.share_slug, 32);
	const shareSlug =
		(existing?.share_slug as string | undefined) ??
		(SLUG_PATTERN.test(bodySlug) ? bodySlug : randomBytes(8).toString('hex'));

	if (body.is_public !== undefined && typeof body.is_public !== 'boolean') {
		error(400, 'is_public must be a boolean.');
	}
	// Private by default: results only become public through the explicit
	// publish step. A retake must not silently undo an existing privacy choice.
	const isPublic = existing ? Boolean(existing.is_public) : (body.is_public ?? false);
	const completedAt = new Date().toISOString();

	// Identity comes from the OAuth session, not the request body, so public
	// results can't impersonate another GitHub user.
	const identity = await resolveGithubIdentity(account, user);

	// A previously generated card represents the old result. Remove it before
	// replacing the row so stale imagery cannot outlive a private retake.
	if (existing) {
		try {
			await storage.deleteFile({
				bucketId: BUCKET_ID,
				fileId: user.$id
			});
		} catch (cause) {
			if (!isAppwriteNotFound(cause)) throw cause;
		}
	}

	const row = await tablesDB.upsertRow({
		databaseId: DB_ID,
		tableId: TABLES.results,
		rowId: user.$id,
		data: {
			user_id: user.$id,
			github_username: identity.github_username,
			display_name: identity.display_name,
			avatar_url: identity.avatar_url,
			archetype_id: scored.primary,
			secondary_archetype_id: scored.secondary,
			scores_json: scoresJson,
			share_slug: shareSlug,
			is_public: isPublic,
			card_file_id: '',
			completed_at: completedAt
		},
		permissions: [
			...(isPublic ? [Permission.read(Role.any())] : [Permission.read(Role.user(user.$id))]),
			Permission.update(Role.user(user.$id)),
			Permission.delete(Role.user(user.$id))
		]
	});

	await upsertProfile(tablesDB, user, identity, { quiz_completed: true });

	const dto = toResultDto(row);
	return json(
		{
			id: dto.id,
			user_id: dto.user_id,
			share_slug: dto.share_slug,
			archetype_id: dto.archetype_id,
			secondary_archetype_id: dto.secondary_archetype_id,
			is_public: dto.is_public,
			completed_at: dto.completed_at
		},
		{ status: existing ? 200 : 201 }
	);
};
