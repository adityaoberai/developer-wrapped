# Developer Wrapped

_Your last 12 months on GitHub, turned into an uncomfortably accurate story._

A mobile-first GitHub Wrapped. Sign in with GitHub, and the app collects **aggregate contribution data for an exact rolling 12-month period** (totals, streaks, busiest month/weekday, PRs, reviews, issues, public language mix — never code or tokens) and turns it into an 8-slide story with an evidence-backed archetype verdict. The 8-question personality quiz is optional and powers a "you said vs. GitHub says" comparison. Everything is **private by default**: publishing is an explicit step that creates an immutable, sanitized share page — with a live "Recently Wrapped" feed of everyone who chose to publish.

Built end-to-end on **Appwrite**: Auth (GitHub OAuth), TablesDB, Realtime, Storage, Functions, and Sites.

## Stack

- **Frontend:** SvelteKit 2 + Svelte 5 (runes) + TypeScript, deployed SSR via `@sveltejs/adapter-node`
- **Backend:** Appwrite Cloud (project `developer-wrapped`, `https://sgp.cloud.appwrite.io/v1`)
  - **Auth:** GitHub OAuth2 with the minimal `read:user` scope (SSR token flow, httpOnly session cookie — no tokens in the browser or database). All other Appwrite auth methods are disabled.
  - **Databases (TablesDB):** `profiles`, `questions`, `answers`, `results`, `archetypes`, plus the Wrapped stores:
    - `wrapped_reports` — private, versioned metric snapshots (rowId = userId). Clients get **read-only** row access; all writes go through validated server code using the API key.
    - `public_shares` — sanitized published editions (random slug rowId, table-level `read("any")`). No client write access; rows are immutable snapshots created only by the explicit publish endpoint.
  - **Realtime:** anonymous subscription to `public_shares` rows for the live feed
  - **Storage:** `share-cards` bucket for generated PNG share cards
  - **Functions:** `github-wrapped` (`functions/github-wrapped`) — background GitHub assimilation. Subscribed to `users.*.sessions.*.create`, so **every sign-in starts a sync without adding any latency to the login flow**; by the time the user reaches `/wrapped` (usually after the quiz) the report is already there. Skips when the snapshot is under 6 hours old; also executable over authenticated HTTP for manual re-syncs. Scopes: `users.read`, `rows.read`, `rows.write` (dynamic API key — nothing stored in env).
- **OG images:** rendered at runtime with `satori` + `@resvg/resvg-js` at `/og` (1200×630; `?slug=` for quiz results, `?wrapped=` for published Wrapped pages)
- **Tests:** `vitest` unit tests for metric calculation (date boundaries, streaks, empty accounts) and story/archetype derivation

## Privacy model

- Signing in requests only `read:user`. The provider access token stays on the Appwrite identity and is used **transiently** server-side for one GraphQL aggregate query per sync — it is never persisted.
- `wrapped_reports` stores only aggregate numbers for an exact, displayed period (`period_start` → `period_end`), plus `metric_version`/`story_version` for reproducibility. Private repository names are filtered out at collection time; private contributions appear only as a single count.
- Quiz results and Wrapped reports are **private by default**. Publishing is an explicit, consent-gated action.
- Publishing a Wrapped creates an edition in `public_shares` containing exactly: display name, avatar, GitHub handle, the reporting period, and a fixed sanitized metric subset (contributions, active days, PRs, reviews, issues, longest streak, busiest month label, top language names). No user ids, no scores, no repo names.
- Republishing creates a **new** slug (a new immutable edition); unpublishing deletes the row and the old link stops resolving. Anonymous readers can only ever see `public_shares` rows and `is_public` quiz results.

## Getting started

```bash
npm install
cp .env.example .env       # already contains the public Appwrite endpoint + project id
npm run dev                # http://localhost:5173
```

`APPWRITE_API_KEY` must be set for the server (session exchange + Wrapped report writes). The key needs the **`sessions.write`, `rows.read`, and `rows.write`** scopes.

### Provisioning Appwrite (already done for this project; repeatable)

```bash
appwrite login
appwrite push settings --force        # disable unused auth methods
appwrite push tables --all --force    # database, tables, columns, indexes (incl. wrapped_reports, public_shares)
appwrite push buckets --all --force   # share-cards bucket
appwrite push functions --function-id github-wrapped --activate --force   # background GitHub sync

# Seed the 8 questions + 8 archetypes (uses a short-lived key):
# PowerShell:
$env:APPWRITE_API_KEY = (appwrite project create-ephemeral-key --scopes 'rows.read' 'rows.write' 'tables.read' --duration 3600 --json --show-secrets | ConvertFrom-Json).secret
npm run seed
```

### GitHub OAuth

The `github` provider is enabled in the Appwrite console (Auth → Settings → GitHub) with a GitHub OAuth app whose callback URL is:

```
https://sgp.cloud.appwrite.io/v1/account/sessions/oauth2/callback/github/developer-wrapped
```

The app's own success/failure URLs are derived from the request origin at runtime, so localhost and production both work without config changes. The login route requests only the `read:user` scope.

## Commands

| Command                                           | What it does                                                |
| ------------------------------------------------- | ----------------------------------------------------------- |
| `npm run dev`                                     | Dev server with HMR                                         |
| `npm run build`                                   | Production build (`./build`)                                |
| `npm run start`                                   | Serve the production build (`node build/index.js`)          |
| `npm run check`                                   | `svelte-check` type + a11y diagnostics                      |
| `npm run test`                                    | Vitest unit tests (metrics + story derivation)              |
| `npm run lint` / `npm run format`                 | Prettier + ESLint                                           |
| `npm run seed`                                    | Upsert quiz questions + archetypes into TablesDB            |
| `npm run icons`                                   | Regenerate `static/apple-touch-icon.png` from the brand SVG |
| `appwrite push sites --site-id developer-wrapped` | Deploy to Appwrite Sites (SSR)                              |

## How it works

- **Consolidated flow:** `/` → GitHub OAuth (`/auth/login` → `/auth/callback` → session cookie) → `/welcome` → quiz (optional) → `/wrapped`. Session creation fires the `github-wrapped` Appwrite Function, which resolves the GitHub identity token via the Users API, runs one GraphQL `contributionsCollection` query for the rolling 12-month window, computes deterministic metrics (JS port of `src/lib/wrapped/metrics.ts`), and upserts the private report — all in the background while the user answers the quiz. The story page polls `GET /api/wrapped` briefly if the report hasn't landed yet and falls back to an inline `POST /api/wrapped` sync. The 8-slide deck (cover → volume → rhythm → collaboration → territory → observation → quiz comparison → verdict) shows a `source:` metric caption under every claim, with keyboard navigation, progress segments, skip, and safe-area/reduced-motion support.
- **Publishing:** slide 8 has the explicit publish step. `POST /api/wrapped/publish` snapshots the sanitized metric subset into `public_shares` under a fresh random slug (immutable edition; republish = new link, unpublish = deleted row) → shareable at `/w/{slug}`.
- **Share cards:** rendered client-side on a `<canvas>` in three formats — 9:16 (1080×1920), 4:5 (1080×1350), 1:1 (1080×1080) — each with one distinctive metric, the reporting period, and the brand URL. Native file sharing via `navigator.share({ files })` where available.
- **Quiz flow (optional):** `/quiz` shows one full-screen question at a time; answers are upserted with deterministic ids `userId_questionId`. Finishing the last question waits for every in-flight save, scores client-side (verified server-side by `POST /api/results`), and lands directly on the consolidated `/wrapped` story, where the quiz archetype powers the "you said vs. GitHub says" slide. The old `/reveal` route 301-redirects to `/wrapped`; `/r/{share_slug}` still serves previously published quiz results.
- **Public reads:** the share page, feed, OG images, and sitemap read through an unauthenticated client, so they can only ever surface `public_shares` rows and `is_public` quiz results.
- **Live feed:** `/feed` server-loads the latest published editions and subscribes to `tablesdb.wrapped.tables.public_shares.rows` in the browser; if the socket fails, the static list still renders ("Live updates unavailable").

## API

All endpoints are SvelteKit server routes under `src/routes/api`:

`GET /api/me` · `POST /api/profile` · `GET /api/questions` · `GET /api/answers?user_id=` · `POST /api/answers` · `POST /api/results` · `GET /api/results/{share_slug}` · `PATCH /api/results/{id}` · `POST /api/card` (share-card upload) · `GET /api/wrapped` (own report) · `POST /api/wrapped` (sync from GitHub) · `POST /api/wrapped/publish` · `DELETE /api/wrapped/publish`

Session validation happens in `src/hooks.server.ts`; every write endpoint verifies the target `user_id` against the session user, and Appwrite table/row permissions enforce the same rules a second time at the database layer (the Wrapped stores accept no client writes at all).
