import { authorized, handle, proxy, requireSession } from "@/app/lib/backend";

export async function GET(_request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  return handle(async () => {
    const session = await requireSession();
    const { taskId } = await params;
    return proxy(await authorized(`/tasks/${encodeURIComponent(taskId)}`, session));
  });
}
