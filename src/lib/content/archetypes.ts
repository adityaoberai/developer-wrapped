import type { Archetype, ArchetypeId } from '$lib/types';
import raw from './archetypes.json';

export const archetypes = raw as Archetype[];

const byId = new Map(archetypes.map((a) => [a.id, a]));

/** Look up an archetype; falls back to the first archetype so bad data can never crash a page. */
export function getArchetype(id: string): Archetype {
	return byId.get(id as ArchetypeId) ?? archetypes[0];
}

export function isArchetypeId(id: string): id is ArchetypeId {
	return byId.has(id as ArchetypeId);
}
