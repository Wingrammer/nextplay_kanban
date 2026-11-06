import { authorized, body, handle, proxy, requireSession, sameOrigin } from "@/app/lib/backend";

export async function GET() {
  return handle(async () => {
    const session = await requireSession();
    return proxy(await authorized(`/users/${encodeURIComponent(session.user.id)}/tasks`, session));
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    sameOrigin(request);
    const session = await requireSession();
    const task = await body(request);
    return proxy(
      await authorized("/tasks", session, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...task, user_id: session.user.id }),
      }),
    );
  });
}
