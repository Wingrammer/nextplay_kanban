This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Authentication setup

Copy `.env.example` to `.env.local`. Set `KANBAN_BACKEND_URL`, generate a
64-character hexadecimal `SESSION_SECRET` using the command in the example,
and set `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` for the same project used
by Gin. Enable anonymous sign-ins in Supabase and start the Gin backend.
Never use a secret or service-role key.

Open the workspace button to initialize or reuse the guest session and load
tasks. The account form links that same user through Gin. Follow any email
confirmation instructions from Supabase. Login, recovery, and email callback
flows are not included in this guest-to-account handoff.

The browser calls only Next.js routes:

- `POST /api/auth/guest`: initializes once or reuses the existing session.
- `POST /api/auth/link`: validates email/password and links the current guest.
- `GET /api/tasks`: lists tasks for the user from the session.
- `POST /api/tasks`: forwards the task JSON with the session's `user_id`.
- `GET /api/tasks/:taskId`: retrieves a task, with authorization enforced by Gin/RLS.

Sessions contain only access/refresh tokens, expiry, and user ID. They are
encrypted and authenticated with AES-256-GCM in an HttpOnly, SameSite=Lax
cookie (Secure in production). Session responses disable caching. Mutation
routes require an Origin matching the public request URL; configure your
reverse proxy to preserve that URL. Tokens never enter browser JavaScript.

Before expiry, or after one backend 401, Next.js refreshes using the official
Supabase client on the server. Optionally set `KANBAN_REFRESH_PATH` to use a Gin
refresh endpoint instead; it must accept `{ "refresh_token": "..." }` and return
`access_token`, `refresh_token`, `expires_at` (or `expires_in`), and `user.id`.
Refresh failures retain the existing identity and never create a replacement
guest. Refresh calls are deduplicated within one server process; multi-instance
deployments should coordinate token rotation with a shared session store.
Cookies expire after 30 idle days. Losing the cookie or changing the encryption
key loses guest access, so link the account before clearing browser data.

Run `pnpm test:auth` for mock-backend integration checks covering guest reuse,
cookie flags, token secrecy, cross-origin rejection, task ownership, linking,
both refresh transports, and preservation of identity after refresh failures.
The test starts a separate development server on port 3197 and uses its own
build directory. No live Supabase credentials are needed.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
