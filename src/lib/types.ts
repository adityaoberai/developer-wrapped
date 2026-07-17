export type ArchetypeId =
	| 'productionCowboy'
	| 'refactorPoet'
	| 'astronautArchitect'
	| 'ductTapeAlchemist'
	| 'tabHoarder'
	| 'darkModeMonk'
	| 'pipelineWhisperer'
	| 'vibeCoder';

export interface Archetype {
	id: ArchetypeId;
	name: string;
	tagline: string;
	roast: string;
	traits: string[];
	emoji: string;
	gradient: [string, string];
	priority: number;
}

export interface QuizOption {
	id: string;
	emoji: string;
	label: string;
}

/** Per-option archetype weights: optionId -> { archetypeId -> points }. */
export type QuestionWeights = Record<string, Partial<Record<ArchetypeId, number>>>;

/** Question as served by GET /api/questions (JSON columns kept as strings, per spec). */
export interface QuestionDto {
	id: string;
	prompt: string;
	options_json: string;
	weights_json: string;
	position: number;
}

/** Question with parsed options/weights, ready for the quiz UI. */
export interface QuizQuestion {
	id: string;
	prompt: string;
	position: number;
	options: QuizOption[];
	weights: QuestionWeights;
}

export interface AnswerDto {
	id: string;
	user_id: string;
	question_id: string;
	option_id: string;
	answered_at: string;
}

export interface ProfileDto {
	id: string;
	user_id: string;
	github_username: string;
	display_name: string;
	avatar_url: string;
	quiz_completed: boolean;
}

export interface ResultDto {
	id: string;
	user_id: string;
	share_slug: string;
	archetype_id: ArchetypeId;
	secondary_archetype_id: ArchetypeId;
	is_public: boolean;
	completed_at: string;
}

export interface MeResponse {
	user: { id: string; name: string; email: string };
	profile: Omit<ProfileDto, 'id' | 'user_id'> | null;
	currentResult: Pick<ResultDto, 'archetype_id'> | null;
}

/** One published Wrapped edition on the live feed — sanitized public_shares data only. */
export interface FeedItem {
	share_slug: string;
	display_name: string;
	github_username: string;
	avatar_url: string;
	archetype_id: ArchetypeId | null;
	contributions: number;
	published_at: string;
}

export function parseQuestion(dto: QuestionDto): QuizQuestion {
	return {
		id: dto.id,
		prompt: dto.prompt,
		position: dto.position,
		options: JSON.parse(dto.options_json) as QuizOption[],
		weights: JSON.parse(dto.weights_json) as QuestionWeights
	};
}
