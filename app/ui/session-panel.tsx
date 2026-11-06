"use client";

import { useState, type FormEvent } from "react";

export default function SessionPanel() {
  const [userId, setUserId] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [tasks, setTasks] = useState<unknown>(null);

  async function request(path: string, init?: RequestInit) {
    const response = await fetch(path, { ...init, cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Request failed");
    return data;
  }

  async function run(action: () => Promise<void>) {
    setPending(true);
    setMessage("");
    try { await action(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Request failed"); }
    finally { setPending(false); }
  }

  function start() {
    void run(async () => {
      const session = await request("/api/auth/guest", { method: "POST" });
      setUserId(session.userId);
      setTasks(await request("/api/tasks"));
    });
  }

  function link(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    void run(async () => {
      const result = await request("/api/auth/link", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: values.get("email"), password: values.get("password") }),
      });
      form.reset();
      setMessage(result.message);
    });
  }

  const button = "rounded-lg bg-blue-600 px-5 py-3 text-white disabled:opacity-50";
  return <section className="mt-8 space-y-6" aria-busy={pending}>
    <button className={button} disabled={pending} onClick={start}>
      {pending ? "Working…" : userId ? "Reload tasks" : "Open my workspace"}
    </button>
    <p role="status" aria-live="polite">{message}</p>
    {userId && <>
      <p className="break-all text-sm text-zinc-500">Workspace: {userId}</p>
      <form onSubmit={link} className="space-y-4 rounded-xl border border-zinc-300 p-6">
        <h2 className="text-xl font-semibold">Save your guest account</h2>
        <label className="block">Email
          <input className="mt-1 block w-full rounded border p-2" name="email" type="email" autoComplete="email" required disabled={pending} />
        </label>
        <label className="block">Password
          <input className="mt-1 block w-full rounded border p-2" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={256} required disabled={pending} />
        </label>
        <button className={button} disabled={pending}>Link account</button>
      </form>
      <div><h2 className="text-xl font-semibold">Tasks</h2>
        <pre className="mt-3 overflow-auto rounded-xl bg-zinc-100 p-4 text-sm text-zinc-900">{tasks === null ? "Tasks could not be loaded. Try again." : JSON.stringify(tasks, null, 2)}</pre>
      </div>
    </>}
  </section>;
}
