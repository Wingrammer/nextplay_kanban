import "server-only";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { parseSession, readSession, writeSession, SessionConfigurationError, type Session } from "./session";

export class ApiError extends Error {
  constructor(message: string, public status = 502) { super(message); }
}

export async function backend(path: string, init: RequestInit = {}) {
  const base = process.env.KANBAN_BACKEND_URL;
  if (!base) throw new ApiError("KANBAN_BACKEND_URL is not configured", 503);
  return fetch(`${base.replace(/\/$/, "")}${path}`, {
    ...init, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000),
  });
}

export function sameOrigin(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    throw new ApiError("Same-origin request required", 403);
  }
}

// Deduplicate rotating refresh tokens for concurrent requests in this process.
const refreshing = new Map<string, Promise<Session>>();
async function refresh(session: Session) {
  let pending = refreshing.get(session.refresh_token);
  if (!pending) {
    pending = (async () => {
      if (!process.env.KANBAN_REFRESH_PATH) {
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!url || !key) throw new ApiError("Configure Supabase server credentials or KANBAN_REFRESH_PATH to refresh sessions", 503);
        const client = createClient(url, key, {
          auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
          global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15000), cache: "no-store" }) },
        });
        const { data, error } = await client.auth.refreshSession({ refresh_token: session.refresh_token });
        if (error || !data.session) throw new ApiError("Unable to refresh session. Your existing session has been preserved.", 401);
        const next = parseSession(data.session);
        if (next.user.id !== session.user.id) throw new ApiError("Refresh changed the session identity");
        return next;
      }
      const response = await backend(process.env.KANBAN_REFRESH_PATH || "/auth/refresh", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: session.refresh_token }),
      });
      if (response.status === 404) throw new ApiError("Configure a backend refresh endpoint to continue this session", 503);
      if (!response.ok) throw new ApiError("Unable to refresh session. Your existing session has been preserved.", response.status === 400 || response.status === 401 ? 401 : 502);
      const next = parseSession(await response.json());
      if (next.user.id !== session.user.id) throw new ApiError("Refresh changed the session identity");
      return next;
    })();
    refreshing.set(session.refresh_token, pending);
    // Short grace period covers concurrent responses using the previous cookie.
    void pending.then(() => { setTimeout(() => refreshing.delete(session.refresh_token), 10000).unref(); }, () => refreshing.delete(session.refresh_token));
  }
  const next = await pending;
  await writeSession(next);
  return next;
}

export async function requireSession() {
  const session = await readSession();
  if (!session) throw new ApiError("Session required", 401);
  return session.expires_at <= Date.now() / 1000 + 60 ? refresh(session) : session;
}

export async function authorized(path: string, session: Session, init: RequestInit = {}) {
  const send = (s: Session) => backend(path, { ...init, headers: { ...Object.fromEntries(new Headers(init.headers)), Authorization: `Bearer ${s.access_token}` } });
  let response = await send(session);
  if (response.status === 401) response = await send(await refresh(session));
  return response;
}

export function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { "Cache-Control": "no-store" } });
}

export async function handle(action: () => Promise<Response>) {
  try { return await action(); }
  catch (error) {
    if (error instanceof SessionConfigurationError) return json({ error: error.message }, 503);
    if (error instanceof ApiError) return json({ error: error.message }, error.status);
    return json({ error: "Unable to complete the request. Check server configuration and session validity." }, 502);
  }
}

export async function body(request: Request): Promise<Record<string, unknown>> {
  try {
    const value = await request.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value;
  } catch { throw new ApiError("Expected a JSON object", 400); }
}

export async function proxy(response: Response) {
  if (!response.ok) return json({ error: "The backend rejected the request" }, response.status);
  return new Response(response.body, { status: response.status, headers: {
    "Content-Type": response.headers.get("content-type") || "application/json", "Cache-Control": "no-store",
  } });
}
