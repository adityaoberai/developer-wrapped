import type { AnswerDto, ArchetypeId, ProfileDto, PublicResult, ResultDto } from '$lib/types';
import type { Models } from 'node-appwrite';

type Row = Models.DefaultRow;

export function toProfileDto(row: Row): ProfileDto {
	return {
		id: row.$id,
		user_id: row.user_id as string,
		github_username: (row.github_username as string) ?? '',
		display_name: (row.display_name as string) ?? '',
		avatar_url: (row.avatar_url as string) ?? '',
		quiz_completed: Boolean(row.quiz_completed)
	};
}

export function toAnswerDto(row: Row): AnswerDto {
	return {
		id: row.$id,
		user_id: row.user_id as string,
		question_id: row.question_id as string,
		option_id: row.option_id as string,
		answered_at: row.answered_at as string
	};
}

export function toResultDto(row: Row): ResultDto {
	return {
		id: row.$id,
		user_id: row.user_id as string,
		share_slug: row.share_slug as string,
		archetype_id: row.archetype_id as ArchetypeId,
		secondary_archetype_id: row.secondary_archetype_id as ArchetypeId,
		is_public: Boolean(row.is_public),
		card_file_id: (row.card_file_id as string) || null,
		completed_at: row.completed_at as string
	};
}

/** Public projection — never exposes user_id or private quiz data. */
export function toPublicResult(row: Row): PublicResult {
	return {
		share_slug: row.share_slug as string,
		github_username: (row.github_username as string) ?? '',
		display_name: (row.display_name as string) ?? '',
		avatar_url: (row.avatar_url as string) ?? '',
		archetype_id: row.archetype_id as ArchetypeId,
		secondary_archetype_id: row.secondary_archetype_id as ArchetypeId,
		scores_json: (row.scores_json as string) ?? '{}',
		is_public: Boolean(row.is_public),
		completed_at: row.completed_at as string
	};
}
