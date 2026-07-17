import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// The quiz-only reveal is folded into the consolidated Wrapped story; old
// links and bookmarks land on the deck instead.
export const GET: RequestHandler = () => {
	redirect(301, '/wrapped');
};
