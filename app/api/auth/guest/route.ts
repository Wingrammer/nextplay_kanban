import { backend, handle, json, requireSession, sameOrigin } from "@/app/lib/backend";
import {
  parseSession,
  readSession,
  writeSession,
  validateSessionConfiguration,
} from "@/app/lib/session";

export async function POST(request: Request) {
  return handle(async () => {
    sameOrigin(request);
    validateSessionConfiguration();
    if (await readSession()) {
      const session = await requireSession();
      return json({ userId: session.user.id });
    }
    const response = await backend("/auth/guest", { method: "POST" });
    if (!response.ok) {
      return json(
        {
          error: `Guest authentication failed in Gin (HTTP ${response.status}). Check the backend's Supabase configuration and anonymous sign-in setting.`,
        },
        502,
      );
    }
    const session = parseSession(await response.json());
    await writeSession(session);
    return json({ userId: session.user.id });
  });
}
