# github-wrapped

Background GitHub assimilation for Developer Wrapped. Every sign-in triggers
this function via the `users.*.sessions.*.create` event, so the user's rolling
12-month contribution report is collected while they're still on the welcome
screen or answering the quiz — the `/wrapped` story is ready the moment they
reach it, with zero latency added to the login flow.

## What it does

1. Resolves the target user (event payload, or the caller's own session on
   HTTP executions — a signed-in user can never sync anyone else's report).
2. Skips if the stored snapshot is under 6 hours old for the same period
   (`force: true` in an HTTP body bypasses this).
3. Reads the user's GitHub `providerAccessToken` transiently from their OAuth
   identity via the Users API — the token is never persisted anywhere.
4. Runs one GitHub GraphQL `contributionsCollection` query for the rolling
   12-month window ([src/github.js](src/github.js)).
5. Computes deterministic aggregate metrics ([src/metrics.js](src/metrics.js),
   a JS port of `src/lib/wrapped/metrics.ts` — keep the two in lockstep).
6. Upserts the private `wrapped_reports` row (rowId = userId, owner-only read
   permission), preserving `is_published`/`share_slug` across re-syncs.

## Triggers

- **Event:** `users.*.sessions.*.create` — fires on every login.
- **HTTP:** authenticated executions (`execute: ["users"]`); body is optional
  JSON `{ "force": true }`. Admin-mode callers (API key / Console / CLI) may
  target a user explicitly with `{ "userId": "<id>" }`.

## Responses

| Status | Body                                           | Meaning                         |
| ------ | ---------------------------------------------- | ------------------------------- |
| 200    | `{ ok: true, synced: true, period_key }`       | Fresh snapshot stored           |
| 200    | `{ ok: true, synced: false, reason: "fresh" }` | Recent snapshot kept            |
| 400    | `{ ok: false, reason: "missing-user" }`        | No resolvable target user       |
| 409    | `{ ok: false, reason: "unauthorized" }`        | No/expired GitHub token on file |
| 429    | `{ ok: false, reason: "rate-limited" }`        | GitHub rate limit               |
| 503    | `{ ok: false, reason: "unavailable" }`         | GitHub unreachable/unexpected   |
| 500    | `{ ok: false, reason: "internal" }`            | Unexpected failure (see logs)   |

## Configuration (source of truth: `appwrite.config.json`)

| Setting        | Value                                   |
| -------------- | --------------------------------------- |
| Runtime        | Node (`node-25`)                        |
| Entrypoint     | `src/main.js`                           |
| Build commands | `npm install`                           |
| Execute access | `users`                                 |
| Events         | `users.*.sessions.*.create`             |
| Scopes         | `users.read`, `rows.read`, `rows.write` |
| Timeout        | 30 seconds                              |
| Specification  | `s-2vcpu-2gb`                           |

No environment variables are required — the function authenticates with the
per-execution dynamic API key (`x-appwrite-key`), which carries the scopes
above.

## Deploy

```bash
appwrite push functions --function-id github-wrapped --activate --force
```
