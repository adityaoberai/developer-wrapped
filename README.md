# Developer Wrapped

_Find out what kind of developer you really are in eight uncomfortably accurate questions._

A mobile-first personality quiz for developers. Sign in with GitHub, answer eight questions, and receive a dramatic archetype diagnosis (from **The Production Cowboy** to **The Vibe Coder**) you can share as a public link or a generated PNG card — with a live "Recently Wrapped" feed of everyone else getting roasted.

Built end-to-end on **Appwrite**: Auth (GitHub OAuth), TablesDB, Realtime, Storage, and Sites.

## Stack

- **Frontend:** SvelteKit 2 + Svelte 5 (runes) + TypeScript, deployed SSR via `@sveltejs/adapter-node`
- **Backend:** Appwrite Cloud (project `developer-wrapped`, `https://sgp.cloud.appwrite.io/v1`)
  - **Auth:** GitHub OAuth2 (SSR token flow, httpOnly session cookie — no tokens in the browser or database)
  - **Databases (TablesDB):** `profiles`, `questions`, `answers`, `results`, `archetypes` with least-privilege row permissions
  - **Realtime:** anonymous subscription to public result rows for the live feed
  - **Storage:** `share-cards` bucket for generated PNG share cards
- **OG images:** rendered at runtime with `satori` + `@resvg/resvg-js` at `/og` (1200×630, per-result variants via `?slug=`)

## Getting started

```bash
npm install
cp .env.example .env       # already contains the public Appwrite endpoint + project id
npm run dev                # http://localhost:5173
```

### Provisioning Appwrite (already done for this project; repeatable)

```bash
appwrite login
appwrite push tables --all --force    # database, tables, columns, indexes
appwrite push buckets --all --force   # share-cards bucket

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

The app's own success/failure URLs are derived from the request origin at runtime, so localhost and production both work without config changes.

## Commands

| Command                                           | What it does                                                |
| ------------------------------------------------- | ----------------------------------------------------------- |
| `npm run dev`                                     | Dev server with HMR                                         |
| `npm run build`                                   | Production build (`./build`)                                |
| `npm run start`                                   | Serve the production build (`node build/index.js`)          |
| `npm run check`                                   | `svelte-check` type + a11y diagnostics                      |
| `npm run lint` / `npm run format`                 | Prettier + ESLint                                           |
| `npm run seed`                                    | Upsert quiz questions + archetypes into TablesDB            |
| `npm run icons`                                   | Regenerate `static/apple-touch-icon.png` from the brand SVG |
| `appwrite push sites --site-id developer-wrapped` | Deploy to Appwrite Sites (SSR)                              |

## How it works

- **Quiz flow:** `/` → GitHub OAuth (`/auth/login` → `/auth/callback` → session cookie) → `/welcome` → `/quiz` (one full-screen question at a time, answers upserted to `answers` with deterministic ids `userId_questionId`, so refresh/resume is free) → `/reveal` (client-side deterministic scoring from DB weights, ties broken by archetype priority, result saved via `POST /api/results`) → `/r/{share_slug}`.
- **Public results:** result rows get `read("any")` only while `is_public` is true; the page, `GET /api/results/{slug}`, the OG image, the sitemap, and the feed all read through an unauthenticated client, so they can never leak private data. Owners can toggle visibility (`PATCH /api/results/{id}`), which rewrites row permissions.
- **Live feed:** `/feed` server-loads the latest public results and subscribes to `tablesdb.wrapped.tables.results.rows` in the browser; if the socket fails, the static list still renders ("Live updates unavailable").
- **Share cards:** rendered client-side on a `<canvas>` (1080×1350), downloaded locally, and uploaded to Storage via `POST /api/card` so results keep a hosted copy.

## API

All spec endpoints are SvelteKit server routes under `src/routes/api`:

`GET /api/me` · `POST /api/profile` · `GET /api/questions` · `GET /api/answers?user_id=` · `POST /api/answers` · `POST /api/results` · `GET /api/results/{share_slug}` · `PATCH /api/results/{id}` · `POST /api/card` (share-card upload)

Session validation happens in `src/hooks.server.ts`; every write endpoint verifies the target `user_id` against the session user, and Appwrite row permissions enforce the same rules a second time at the database layer.
