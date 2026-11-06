"use client";
import { useCallback, useEffect, useState } from "react";
import { boardRequest } from "@/app/lib/board-api";
type Invitation = { id: string; board_name: string; email: string; expires_at: string };

export function Invitations({ joined }: { joined: (id: string) => Promise<void> }) {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const reload = useCallback(async () => {
    setInvitations(await boardRequest<Invitation[]>("invitations"));
  }, []);
  useEffect(() => {
    const refresh = () => {
      void reload().catch(() => setError("Invitations could not refresh. Try again."));
    };
    refresh();
    const timer = setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [reload]);
  async function respond(id: string, accept: boolean) {
    setBusy(id);
    setError("");
    try {
      const board = await boardRequest<string | null>("invitations/respond", "POST", {
        invitation_id: id,
        accept,
      });
      await reload();
      if (board) await joined(board);
    } catch (value) {
      setError(value instanceof Error ? value.message : "Unable to respond");
    } finally {
      setBusy(null);
    }
  }
  return (
    <section aria-label="Workspace invitations">
      {invitations.map((invite) => (
        <div className="invitation-result" key={invite.id}>
          <strong>Invitation to {invite.board_name}</strong>
          <p>
            For {invite.email} · Expires {new Date(invite.expires_at).toLocaleDateString()}
          </p>
          <div className="form-actions">
            <button
              className="secondary-button"
              disabled={!!busy}
              onClick={() => void respond(invite.id, false)}
            >
              Decline
            </button>
            <button
              className="primary-button"
              disabled={!!busy}
              onClick={() => void respond(invite.id, true)}
            >
              {busy === invite.id ? "Saving…" : "Accept invitation"}
            </button>
          </div>
        </div>
      ))}
      {error && (
        <p role="alert" className="form-error">
          {error}{" "}
          <button
            className="text-button"
            onClick={() =>
              void reload()
                .then(() => setError(""))
                .catch(() => {})
            }
          >
            Retry
          </button>
        </p>
      )}
    </section>
  );
}
