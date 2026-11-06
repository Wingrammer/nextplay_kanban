import { authorized, body, handle, proxy, requireSession, sameOrigin } from "@/app/lib/backend";

type Context = { params: Promise<{ taskId: string }> };

export async function GET(_request: Request, { params }: Context) {
  return handle(async () => {
    const session = await requireSession();
    const { taskId } = await params;
    return proxy(await authorized(`/tasks/${encodeURIComponent(taskId)}`, session));
  });
}

export async function PATCH(request: Request, { params }: Context) {
  return handle(async () => {
    sameOrigin(request);
    const session = await requireSession();
    const { taskId } = await params;
    return proxy(
      await authorized(`/tasks/${encodeURIComponent(taskId)}`, session, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(await body(request)),
      }),
    );
  });
}
