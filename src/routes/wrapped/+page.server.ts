import { readApiJson } from '$lib/server/http';
import type { MeResponse } from '$lib/types';
import type { WrappedReportDto } from '$lib/wrapped/types';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, fetch }) => {
	const auth = await locals.auth();
	if (!auth) redirect(302, '/');

	const [reportRes, meRes] = await Promise.all([fetch('/api/wrapped'), fetch('/api/me')]);
	const { report } = await readApiJson<{ report: WrappedReportDto | null }>(
		reportRes,
		'wrapped report'
	);
	const me = await readApiJson<MeResponse>(meRes, 'account');

	return {
		report,
		profile: me.profile,
		quizArchetypeId: me.currentResult?.archetype_id ?? null
	};
};
