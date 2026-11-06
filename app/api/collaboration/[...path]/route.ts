import {
  authorized,
  backend,
  body,
  handle,
  proxy,
  requireSession,
  sameOrigin,
} from "@/app/lib/backend";

type Context = { params: Promise<{ path: string[] }> };
export const maxDuration = 300;

// One small, allowlisted proxy keeps every collaboration request behind Gin.
async function forward(request: Request, context: Context) {
  return handle(async () => {
    const { path } = await context.params;
    const route = path.join("/");
    const allowed =
      request.method === "DELETE"
        ? /^boards\/[^/]+$/.test(route)
        : request.method === "GET"
          ? /^(workspace|invitations|boards\/[^/]+\/events|boards\/[^/]+\/tasks\/[^/]+)$/.test(
              route,
            )
          : /^(invitations\/(accept|respond)|boards\/[^/]+\/(members|labels|tasks)|boards\/[^/]+\/tasks\/[^/]+(\/(comments|labels))?)$/.test(
              route,
            );
    if (!allowed) return Response.json({ error: "Route not found" }, { status: 404 });
    if (request.method !== "GET") sameOrigin(request);
    const session = await requireSession();
    const query = new URL(request.url).searchParams.get("board");
    const upstream = `/${path.map(encodeURIComponent).join("/")}${route === "workspace" && query ? `?board=${encodeURIComponent(query)}` : ""}`;
    if (route.endsWith("/events")) {
      const stream = await backend(upstream, {
        headers: { Authorization: `Bearer ${session.access_token}` },
        signal: request.signal,
      });
      if (!stream.ok) return proxy(stream);
      return new Response(stream.body, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-store",
          "X-Accel-Buffering": "no",
        },
      });
    }
    return proxy(
      await authorized(upstream, session, {
        method: request.method,
        ...(request.method !== "GET"
          ? {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(await body(request)),
            }
          : {}),
      }),
    );
  });
}

export const GET = forward;
export const POST = forward;
export const PATCH = forward;
export const PUT = forward;
export const DELETE = forward;
