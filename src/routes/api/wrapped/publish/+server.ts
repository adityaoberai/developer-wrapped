import { createAdminClient, getRowOrNull, requireAuth, TABLES } from '$lib/server/appwrite';
import { resolveGithubIdentity } from '$lib/server/github';
import { publishShare, toReportDto, unpublishShare } from '$lib/server/wrapped/reports';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Explicit publish step: creates a new immutable edition of the caller's
 * Wrapped as a sanitized public_shares row and returns its share slug.
 * Nothing becomes public without this call.
 */
export const POST: RequestHandler = async ({ locals }) => {
	const { user, account, tablesDB } = await requireAuth(locals);

	const reportRow = await getRowOrNull(tablesDB, TABLES.wrappedReports, user.$id);
	if (!reportRow) {
		error(404, 'Generate your Wrapped before publishing it.');
	}
	const report = toReportDto(reportRow);

	// Identity comes from the OAuth session, never from the request body.
	const identity = await resolveGithubIdentity(account, user);

	// Optional quiz comparison: only the archetype id, never scores or answers.
	const quizRow = await getRowOrNull(tablesDB, TABLES.results, user.$id);
	const quizArchetypeId = quizRow ? ((quizRow.archetype_id as string) ?? null) : null;

	const { tablesDB: adminTablesDB } = createAdminClient();
	const share = await publishShare(adminTablesDB, report, identity, quizArchetypeId);
	return json({ share }, { status: 201 });
};

/** Revoke the live edition. The public link stops resolving immediately. */
export const DELETE: RequestHandler = async ({ locals }) => {
	const { user, tablesDB } = await requireAuth(locals);

	const reportRow = await getRowOrNull(tablesDB, TABLES.wrappedReports, user.$id);
	if (!reportRow) {
		error(404, 'No Wrapped report to unpublish.');
	}

	const { tablesDB: adminTablesDB } = createAdminClient();
	await unpublishShare(adminTablesDB, toReportDto(reportRow));
	return json({ ok: true });
};
