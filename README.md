# Kanban frontend

A responsive Kanban board built with Next.js App Router, TypeScript, Tailwind
CSS, and Poppins. Uses the starter's neutral light/dark palette.

Live frontend: https://nextplay-kanban-pi.vercel.app

Live Gin API and Swagger: https://nextplay-kanban-api.vercel.app/swagger/index.html

## Architecture

```text
Browser → Next.js session/proxy routes → Gin API → Supabase Auth / Postgres
```

Gin owns authentication, token refresh, task validation, database access, and
database migrations. Supabase credentials and SQL migrations belong in the
`kanban-backend` repository. This frontend has no Supabase client or database
connection.

Next.js stores the session in an authenticated, encrypted HttpOnly cookie and
forwards the access token to Gin. Tokens are never exposed to browser JavaScript.
Before expiry, or after one upstream 401, Next.js calls Gin's `/auth/refresh`,
updates the cookie, and retries as needed. Failed refreshes preserve the existing
identity instead of silently creating a replacement guest.

## Local setup

1. Follow the setup instructions in `../kanban-backend/README`, including its
   Supabase migrations and anonymous sign-in configuration. Start Gin.
2. Run `pnpm install`.
3. Copy `.env.example` to `.env.local`. Set `KANBAN_BACKEND_URL` and generate
   `SESSION_SECRET` with the command in the example. Keep this secret stable
   across restarts and server instances.
4. Run `pnpm dev` and open http://localhost:3000.

Only two frontend environment variables are required:

| Variable             | Purpose                                                         |
| -------------------- | --------------------------------------------------------------- |
| `KANBAN_BACKEND_URL` | Gin API URL; defaults in the example to `http://localhost:8080` |
| `SESSION_SECRET`     | 32-byte encryption key represented as 64 hexadecimal characters |

## API boundary

| Next.js route              | Gin endpoint                                            |
| -------------------------- | ------------------------------------------------------- |
| `POST /api/auth/guest`     | `POST /auth/guest` (only when there is no session)      |
| `POST /api/auth/link`      | `POST /auth/link`                                       |
| `GET /api/auth/account`    | `GET /auth/account` (current verified account state)    |
| `POST /api/auth/session`   | `POST /auth/session` (confirmation return)              |
| `POST /api/auth/password`  | `POST /auth/password` (after verification)              |
| `POST /api/auth/login`     | `POST /auth/login`                                      |
| `GET /api/tasks`           | `GET /users/:user_id/tasks` using the session's user ID |
| `POST /api/tasks`          | `POST /tasks` using the session's user ID               |
| `GET /api/tasks/:taskId`   | `GET /tasks/:task_id`                                   |
| `PATCH /api/tasks/:taskId` | `PATCH /tasks/:task_id`                                 |

Refresh tokens are sent only from the Next.js server to Gin's `POST /auth/refresh`.
Cookies use SameSite=Lax, HttpOnly, and Secure in production. Mutation routes
require a matching Origin/Host. Configure a reverse proxy to preserve the public
host and protocol. Session responses and task requests disable caching.

## Board behavior

- Guest sessions open automatically and persist across reloads.
- Create/edit tasks, search by title or description, and filter by status/priority.
- Move cards with their drag handle, left/right arrow keys on the handle, or
  their status menu. Changes save through Gin and roll back on failure.
- Board/list views, responsive columns, loading skeletons, empty states, and
  retryable errors.
- Save a guest by confirming an email, then setting a password. Confirmation
  returns are handled and account state is re-read from Gin. Existing accounts
  can sign in from the same dialog. Password recovery is not implemented.

## Collaboration features

- Shared boards with named team members, optional accent colors, multiple task
  assignees, and assignee avatars. Owners invite by email; verified recipients
  accept or decline in their own workspace. Invitations expire in seven days.
- Supabase Realtime Postgres Changes reaches Gin through an authenticated
  WebSocket. Gin relays SSE after committed writes. Drag previews are local;
  drops use optimistic UI and last-committed-write-wins reconciliation.
- Task details include persistent chronological comments and a timestamped
  activity timeline generated atomically by database triggers.
- Board-specific labels, multiple tags per task, calendar due dates, overdue
  and due-soon badges, combined text/priority/person/label filters, and whole-board
  total/completed/overdue statistics.
- Folder-shaped task cards keep the starter's neutral palette and Poppins.

The browser uses `/api/collaboration/...` for these features. Next.js forwards
the user's JWT to Gin; it contains no Supabase client or database credentials.
The earlier `/api/tasks` routes remain compatible with the personal-task API.

See [the architecture walkthrough](docs/architecture.md) for a file-by-file guide,
the event flow, invitation rules, and the conflict-policy tradeoffs.

## Validation and deployment

Run `pnpm test`, `pnpm lint`, and `pnpm build`. Backend endpoint and repository tests live
with Gin and run with `go test ./...` from that repository.

Deploy Next.js and Gin separately. Configure the same frontend encryption key
on all Next.js instances. Refresh requests are deduplicated within one process;
multiple instances should coordinate rotation through a shared session store.
Cookies expire after 30 idle days. Clearing the cookie or changing the encryption
key loses guest access, so link an account before clearing browser data.

On Vercel, the collaboration proxy allows 300 seconds. Gin ends each SSE stream
cleanly after 240 seconds; the browser reconnects and reloads its snapshot. Tabs
share stream ownership to avoid exhausting browser connections. Production Auth
redirects point to the live frontend; localhost remains an allowed redirect.
