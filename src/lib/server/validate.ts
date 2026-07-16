/** Coerce unknown input to a trimmed string capped at `max` chars ('' when not a string). */
export function asString(value: unknown, max: number): string {
	return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

/** Normalize unknown input to an ISO 8601 datetime, or null when invalid. */
export function asIsoDate(value: unknown): string | null {
	if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) return null;
	return new Date(value).toISOString();
}

export const ID_PATTERN = /^[a-zA-Z0-9._-]{1,36}$/;
export const SLUG_PATTERN = /^[a-z0-9-]{6,32}$/;
