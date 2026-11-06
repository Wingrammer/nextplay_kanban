import SessionPanel from "./ui/session-panel";

export default function Home() {
  return <main className="mx-auto w-full max-w-3xl p-8 sm:p-16">
    <h1 className="text-3xl font-semibold">Your Kanban workspace</h1>
    <p className="mt-3 text-zinc-500">Start as a guest, then save your account when you’re ready.</p>
    <SessionPanel />
  </main>;
}
