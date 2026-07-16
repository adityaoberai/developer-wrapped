import { error } from '@sveltejs/kit';

/** Read an internal API response without turning an error payload into page data. */
export async function readApiJson<T>(response: Response, label: string): Promise<T> {
	if (!response.ok) {
		error(response.status, `Unable to load ${label}.`);
	}
	try {
		return (await response.json()) as T;
	} catch {
		error(502, `The ${label} response was invalid.`);
	}
}

export function requireArray<T>(value: T[] | unknown, label: string): T[] {
	if (!Array.isArray(value)) error(502, `The ${label} response was invalid.`);
	return value as T[];
}
