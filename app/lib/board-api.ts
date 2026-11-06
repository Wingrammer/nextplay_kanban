export class BoardError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function boardRequest<T>(path: string, method = "GET", data?: unknown): Promise<T> {
  const response = await fetch(`/api/collaboration/${path}`, {
    method,
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
    ...(data === undefined
      ? {}
      : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
  });
  const result = await response.json();
  if (!response.ok)
    throw new BoardError(
      result.error || "The request could not be saved. Please try again.",
      response.status,
    );
  return result;
}

// React Strict Mode can remount effects. Share the initial guest request so it
// cannot create a second identity before the first response sets its cookie.
let opening: Promise<void> | null = null;
export function ensureGuest(): Promise<void> {
  if (!opening)
    opening = fetch("/api/auth/guest", { method: "POST", signal: AbortSignal.timeout(20000) })
      .then(async (response) => {
        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.error || "Unable to open your workspace");
        }
      })
      .finally(() => {
        opening = null;
      });
  return opening;
}
