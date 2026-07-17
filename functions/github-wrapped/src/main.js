import {
  Client,
  Permission,
  Query,
  Role,
  TablesDB,
  Users,
} from 'node-appwrite';
import { fetchGithubStats, GithubSyncError } from './github.js';
import {
  computeMetrics,
  METRIC_VERSION,
  rollingYearPeriod,
  STORY_VERSION,
} from './metrics.js';

const DB_ID = 'wrapped';
const REPORTS_TABLE = 'wrapped_reports';

// A login re-triggers the sync via the sessions.create event; within this
// window the existing snapshot is fresh enough to keep.
const FRESH_SYNC_MS = 6 * 60 * 60 * 1000;

/**
 * Background GitHub assimilation. Triggered by:
 * - `users.*.sessions.*.create` events — every sign-in refreshes the report
 *   without adding any latency to the login flow;
 * - authenticated HTTP executions — manual re-sync from the app (`force: true`
 *   bypasses the freshness window).
 *
 * The user's GitHub token is read transiently from their OAuth identity and
 * never persisted; only aggregate metrics are stored in `wrapped_reports`.
 */
export default async ({ req, res, log, error }) => {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(req.headers['x-appwrite-key'] ?? '');
  const users = new Users(client);
  const tablesDB = new TablesDB(client);

  const trigger = req.headers['x-appwrite-trigger'];
  const body = safeBodyJson(req);

  // Events carry the session model; HTTP executions carry the caller's user id
  // in a header Appwrite sets itself. A body-supplied target is honored only
  // for admin-mode callers (API key, or a console session — whose user id
  // never resolves in this project), so a signed-in project user can never
  // sync anyone else's report.
  const sessionUserId = req.headers['x-appwrite-user-id'] || null;
  let userId = null;
  if (trigger === 'event') {
    userId = body?.userId ?? null;
  } else if (
    typeof body?.userId === 'string' &&
    body.userId !== sessionUserId
  ) {
    userId =
      sessionUserId && (await isProjectUser(users, sessionUserId))
        ? sessionUserId
        : body.userId;
  } else {
    userId = sessionUserId ?? body?.userId ?? null;
  }
  if (!userId || typeof userId !== 'string') {
    return res.json({ ok: false, reason: 'missing-user' }, 400);
  }
  const force = trigger !== 'event' && body?.force === true;

  try {
    const period = rollingYearPeriod(new Date());
    const existing = await getReportOrNull(tablesDB, userId);

    if (existing && !force) {
      const age = Date.now() - new Date(existing.synced_at).getTime();
      if (
        existing.period_key === period.key &&
        age >= 0 &&
        age < FRESH_SYNC_MS
      ) {
        log(
          `Report for ${userId} is fresh (${Math.round(age / 60000)}m old) — skipping sync.`
        );
        return res.json({
          ok: true,
          synced: false,
          reason: 'fresh',
          period_key: period.key,
        });
      }
    }

    const accessToken = await resolveGithubToken(users, userId);
    if (!accessToken) {
      log(`No GitHub token on file for ${userId} — nothing to sync.`);
      return res.json({ ok: false, reason: 'unauthorized' }, 409);
    }

    const raw = await fetchGithubStats(accessToken, period);
    const metrics = computeMetrics(raw, period);

    await tablesDB.upsertRow({
      databaseId: DB_ID,
      tableId: REPORTS_TABLE,
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
        // Publish state survives re-syncs; published pages keep serving their
        // immutable edition until the owner republishes.
        is_published: existing?.is_published ?? false,
        share_slug: existing?.share_slug ?? '',
      },
      permissions: [Permission.read(Role.user(userId))],
    });

    log(
      `Synced ${period.key} for ${userId}: ${metrics.totals.contributions} contributions, ` +
        `${metrics.activeDays} active days (${metrics.coverage} coverage).`
    );
    return res.json({ ok: true, synced: true, period_key: period.key });
  } catch (cause) {
    if (cause instanceof GithubSyncError) {
      error(
        `GitHub sync failed for ${userId}: ${cause.kind} — ${cause.message}`
      );
      const status =
        cause.kind === 'unauthorized'
          ? 409
          : cause.kind === 'rate-limited'
            ? 429
            : 503;
      return res.json({ ok: false, reason: cause.kind }, status);
    }
    error(`Unexpected sync failure for ${userId}: ${cause?.message ?? cause}`);
    return res.json({ ok: false, reason: 'internal' }, 500);
  }
};

function safeBodyJson(req) {
  try {
    const parsed = req.bodyJson;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * The provider access token lives on the user's GitHub OAuth identity (token
 * flow sessions never carry it). Appwrite records a zero lifetime for GitHub
 * OAuth-app tokens, so the identity's expiry field is meaningless — the token
 * is used whenever it exists and GitHub itself decides whether it still works.
 */
async function resolveGithubToken(users, userId) {
  const { identities } = await users.listIdentities({
    queries: [
      Query.equal('userId', userId),
      Query.equal('provider', 'github'),
      Query.orderDesc('$updatedAt'),
      Query.limit(1),
    ],
  });
  return identities[0]?.providerAccessToken || null;
}

async function isProjectUser(users, userId) {
  try {
    await users.get({ userId });
    return true;
  } catch (cause) {
    if (cause?.code === 404) return false;
    throw cause;
  }
}

async function getReportOrNull(tablesDB, userId) {
  try {
    const row = await tablesDB.getRow({
      databaseId: DB_ID,
      tableId: REPORTS_TABLE,
      rowId: userId,
    });
    return {
      period_key: row.period_key,
      synced_at: row.synced_at,
      is_published: Boolean(row.is_published),
      share_slug: row.share_slug || '',
    };
  } catch (cause) {
    if (cause?.code === 404) return null;
    throw cause;
  }
}
