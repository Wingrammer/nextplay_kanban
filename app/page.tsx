import SessionPanel from "./ui/session-panel";
import { Suspense } from "react";

export default function Home() {
  // Board dates and guest sessions are resolved for each browser visit.
  return (
    <Suspense fallback={<main aria-busy="true">Loading your board…</main>}>
      <SessionPanel />
    </Suspense>
  );
}
