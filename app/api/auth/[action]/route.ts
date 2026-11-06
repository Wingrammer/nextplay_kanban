import {
  authorized,
  backend,
  body,
  handle,
  json,
  proxy,
  requireSession,
  sameOrigin,
} from "@/app/lib/backend";
import { parseSession, writeSession } from "@/app/lib/session";

export async function GET(request: Request, context: { params: Promise<{ action: string }> }) {
  return handle(async () => {
    if ((await context.params).action !== "account") return json({ error: "Not found" }, 404);
    return proxy(await authorized("/auth/account", await requireSession()));
  });
}

export async function POST(request: Request, context: { params: Promise<{ action: string }> }) {
  return handle(async () => {
    sameOrigin(request);
    const { action } = await context.params;
    if (action !== "session" && action !== "password" && action !== "login")
      return json({ error: "Not found" }, 404);
    const input = await body(request);
    const init = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    };
    if (action === "password")
      return proxy(await authorized("/auth/password", await requireSession(), init));
    const response = await backend(`/auth/${action}`, init);
    if (!response.ok) return proxy(response);
    // Gin validates the confirmation session with Auth. Tokens stay in an HttpOnly cookie.
    await writeSession(parseSession(await response.json()));
    return json({ ok: true });
  });
}
