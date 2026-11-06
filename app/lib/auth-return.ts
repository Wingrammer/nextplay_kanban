// Share confirmation processing across React Strict Mode's effect remounts.
let returning: Promise<void> | null = null;
export function finishAuthReturn(): Promise<void> {
  if (returning) return returning;
  const fragment = new URLSearchParams(window.location.hash.slice(1));
  if (!fragment.has("refresh_token") && !fragment.has("error")) return Promise.resolve();
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
  returning = (async () => {
    if (fragment.has("error"))
      throw new Error(fragment.get("error_description") || "Confirmation link expired");
    const response = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: fragment.get("refresh_token") }),
      signal: AbortSignal.timeout(20000),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Unable to confirm your account");
  })();
  return returning;
}
