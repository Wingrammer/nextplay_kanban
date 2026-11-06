import {
  ApiError,
  authorized,
  body,
  handle,
  json,
  requireSession,
  sameOrigin,
} from "@/app/lib/backend";
import { parseSession, writeSession } from "@/app/lib/session";

export async function POST(request: Request) {
  return handle(async () => {
    sameOrigin(request);
    const session = await requireSession();
    const { email, password } = await body(request);
    if (
      typeof email !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
      typeof password !== "string" ||
      password.length < 8 ||
      password.length > 256
    ) {
      throw new ApiError("Enter a valid email and a password of 8–256 characters", 400);
    }
    const response = await authorized("/auth/link", session, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), password }),
    });
    if (!response.ok)
      return json(
        { error: "Unable to link account. Check your details and try again." },
        response.status,
      );
    const result = await response.json().catch(() => null);
    if (result?.access_token) {
      const updated = parseSession(result);
      if (updated.user.id !== session.user.id)
        throw new ApiError("Link changed the session identity");
      await writeSession(updated);
    }
    // Do not forward auth responses: they may contain tokens or private metadata.
    return json({
      ok: true,
      message: "Account link requested. Check your email for any confirmation instructions.",
    });
  });
}
