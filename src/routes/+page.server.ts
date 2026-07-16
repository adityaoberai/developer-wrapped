import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const auth = await locals.auth();
	return {
		signedIn: auth !== null,
		name: auth?.user.name ?? null
	};
};
