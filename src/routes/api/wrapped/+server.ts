import { createAdminClient, getRowOrNull, requireAuth, TABLES } from '$lib/server/appwrite';
import { hasGithubToken, resolveGithubAccess } from '$lib/server/github';
import { fetchGithubStats, GithubSyncError } from '$lib/server/wrapped/github';
import { toReportDto, upsertReport } from '$lib/server/wrapped/reports';
import { computeMetrics, rollingYearPeriod } from '$lib/wrapped/metrics';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Load the caller's private Wrapped report (null when never synced). While the
 * report is missing, `canSync` tells the poller whether the background sync
 * can succeed at all — false means no GitHub token is on file, so waiting for
 * the login-triggered function is pointless and the reconnect prompt should
 * show immediately.
 */
export const GET: RequestHandler = async ({ locals }) => {
	const { user, account, tablesDB } = await requireAuth(locals);
	const row = await getRowOrNull(tablesDB, TABLES.wrappedReports, user.$id);
	if (row) return json({ report: toReportDto(row) });
	return json({ report: null, canSync: await hasGithubToken(account) });
};

/**
 * Collect a fresh rolling 12-month snapshot from GitHub and store it as the
 * caller's private report. The provider token is used transiently for this
 * one collection and never persisted. Only aggregates are stored.
 */
export const POST: RequestHandler = async ({ locals }) => {
	const { user, account, tablesDB } = await requireAuth(locals);

	const { accessToken } = await resolveGithubAccess(account, user);
	if (!accessToken) {
		error(409, 'GitHub authorization is missing or expired. Sign in with GitHub again.');
	}

	const period = rollingYearPeriod(new Date());
	let raw;
	try {
		raw = await fetchGithubStats(accessToken, period);
	} catch (cause) {
		if (cause instanceof GithubSyncError) {
			if (cause.kind === 'unauthorized') {
				error(409, 'GitHub authorization is missing or expired. Sign in with GitHub again.');
			}
			if (cause.kind === 'rate-limited') {
				error(429, 'GitHub rate limit reached. Try again in a few minutes.');
			}
			error(503, 'GitHub is unavailable right now. Try again shortly.');
		}
		throw cause;
	}

	const metrics = computeMetrics(raw, period);

	// Preserve the owner's publish state across re-syncs; published pages keep
	// showing their immutable edition until the owner republishes.
	const existingRow = await getRowOrNull(tablesDB, TABLES.wrappedReports, user.$id);
	const existing = existingRow
		? {
				is_published: Boolean(existingRow.is_published),
				share_slug: (existingRow.share_slug as string) || null
			}
		: null;

	const { tablesDB: adminTablesDB } = createAdminClient();
	const report = await upsertReport(adminTablesDB, user.$id, metrics, existing);
	return json({ report }, { status: existingRow ? 200 : 201 });
};
