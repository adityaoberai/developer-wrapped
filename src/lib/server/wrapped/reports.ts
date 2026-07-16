import { DB_ID, isAppwriteNotFound, TABLES } from '$lib/server/appwrite';
import type { GithubIdentity } from '$lib/server/github';
import { toSharedMetrics } from '$lib/wrapped/metrics';
import { deriveGithubArchetype } from '$lib/wrapped/story';
import {
	METRIC_VERSION,
	STORY_VERSION,
	type PublicShareDto,
	type SharedMetrics,
	type WrappedMetrics,
	type WrappedReportDto
} from '$lib/wrapped/types';
import { randomBytes } from 'node:crypto';
import { Permission, Role, type Models, type TablesDB } from 'node-appwrite';

export function toReportDto(row: Models.DefaultRow): WrappedReportDto {
	return {
		user_id: row.user_id as string,
		period_start: row.period_start as string,
		period_end: row.period_end as string,
		period_key: row.period_key as string,
		synced_at: row.synced_at as string,
		coverage: (row.coverage as 'full' | 'partial') ?? 'full',
		metrics: JSON.parse(row.metrics_json as string) as WrappedMetrics,
		metric_version: row.metric_version as number,
		story_version: row.story_version as number,
		is_published: Boolean(row.is_published),
		share_slug: (row.share_slug as string) || null
	};
}

export function toPublicShareDto(row: Models.DefaultRow): PublicShareDto {
	return {
		share_slug: row.share_slug as string,
		display_name: (row.display_name as string) ?? '',
		github_username: (row.github_username as string) ?? '',
		avatar_url: (row.avatar_url as string) ?? '',
		period_start: row.period_start as string,
		period_end: row.period_end as string,
		metrics: JSON.parse(row.metrics_json as string) as SharedMetrics,
		archetype_id: (row.archetype_id as string) || null,
		quiz_archetype_id: (row.quiz_archetype_id as string) || null,
		published_at: row.published_at as string
	};
}

/**
 * Persist the private report snapshot (rowId = userId, one report per user).
 * Writes go through the admin client because the table grants clients no
 * permissions; the owner gets read access on the row and nothing else, so a
 * report can never be tampered with from the browser.
 */
export async function upsertReport(
	adminTablesDB: TablesDB,
	userId: string,
	metrics: WrappedMetrics,
	existing: { is_published: boolean; share_slug: string | null } | null
): Promise<WrappedReportDto> {
	const row = await adminTablesDB.upsertRow({
		databaseId: DB_ID,
		tableId: TABLES.wrappedReports,
		rowId: userId,
		data: {
			user_id: userId,
			period_start: metrics.period.start,
			period_end: metrics.period.end,
			period_key: metrics.period.key,
			synced_at: new Date().toISOString(),
			coverage: metrics.coverage,
			metrics_json: JSON.stringify(metrics),
			metric_version: METRIC_VERSION,
			story_version: STORY_VERSION,
			is_published: existing?.is_published ?? false,
			share_slug: existing?.share_slug ?? ''
		},
		permissions: [Permission.read(Role.user(userId))]
	});
	return toReportDto(row);
}

/**
 * Publish a new immutable edition: a fresh random slug pointing at a sanitized
 * snapshot of the current report. Any previous edition is revoked first so
 * exactly one live edition exists per user, and a published page's content
 * never changes after publication.
 */
export async function publishShare(
	adminTablesDB: TablesDB,
	report: WrappedReportDto,
	identity: GithubIdentity,
	quizArchetypeId: string | null
): Promise<PublicShareDto> {
	await deleteShareIfExists(adminTablesDB, report.share_slug);

	const slug = randomBytes(8).toString('hex');
	const verdict = deriveGithubArchetype(report.metrics);
	const row = await adminTablesDB.createRow({
		databaseId: DB_ID,
		tableId: TABLES.publicShares,
		rowId: slug,
		data: {
			share_slug: slug,
			display_name: identity.display_name,
			github_username: identity.github_username,
			avatar_url: identity.avatar_url,
			period_start: report.period_start,
			period_end: report.period_end,
			metrics_json: JSON.stringify(toSharedMetrics(report.metrics)),
			archetype_id: verdict.archetypeId,
			quiz_archetype_id: quizArchetypeId ?? '',
			story_version: STORY_VERSION,
			published_at: new Date().toISOString()
		}
	});

	await adminTablesDB.updateRow({
		databaseId: DB_ID,
		tableId: TABLES.wrappedReports,
		rowId: report.user_id,
		data: { is_published: true, share_slug: slug }
	});

	return toPublicShareDto(row);
}

/** Revoke the live edition. The share link stops resolving immediately. */
export async function unpublishShare(
	adminTablesDB: TablesDB,
	report: WrappedReportDto
): Promise<void> {
	await deleteShareIfExists(adminTablesDB, report.share_slug);
	await adminTablesDB.updateRow({
		databaseId: DB_ID,
		tableId: TABLES.wrappedReports,
		rowId: report.user_id,
		data: { is_published: false, share_slug: '' }
	});
}

async function deleteShareIfExists(adminTablesDB: TablesDB, slug: string | null): Promise<void> {
	if (!slug) return;
	try {
		await adminTablesDB.deleteRow({ databaseId: DB_ID, tableId: TABLES.publicShares, rowId: slug });
	} catch (cause) {
		if (!isAppwriteNotFound(cause)) throw cause;
	}
}
