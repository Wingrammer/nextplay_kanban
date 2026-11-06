"use client";
import { useState, type FormEvent } from "react";
import { boardRequest } from "@/app/lib/board-api";
import type { Workspace } from "@/app/lib/tasks";
import { Avatar, Modal } from "./primitives";

export function TeamDialog({
  workspace,
  close,
  reload,
}: {
  workspace: Workspace;
  close: () => void;
  reload: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await boardRequest<{ email: string }>(
        `boards/${workspace.board.id}/members`,
        "POST",
        { email: form.get("email"), name: form.get("name"), color: form.get("color") },
      );
      setNotice(
        `Invitation is waiting in ${result.email}'s workspace. They must sign in with that verified email to accept it.`,
      );
      await reload();
    } catch (value) {
      setError(value instanceof Error ? value.message : "Unable to create invitation");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Team members" close={close}>
      <p className="form-intro">
        Invite by email. The recipient can accept or decline in their own workspace. No email
        message is sent.
      </p>
      <ul className="member-list">
        {workspace.members.map((member) => (
          <li key={member.id}>
            <Avatar member={member} />
            <div>
              <strong>{member.name}</strong>
              <span>{member.user_id ? "Connected" : "Invitation pending"}</span>
            </div>
          </li>
        ))}
      </ul>
      {workspace.user_id === workspace.board.owner_id && (
        <form className="workspace-form" onSubmit={submit}>
          <label>
            Email address
            <input
              name="email"
              type="email"
              required
              maxLength={254}
              autoComplete="email"
              disabled={busy}
            />
          </label>
          <div className="member-add">
            <label>
              Display name (optional)
              <input name="name" maxLength={80} disabled={busy} />
            </label>
            <label>
              Color
              <input name="color" type="color" defaultValue="#71717a" disabled={busy} />
            </label>
          </div>
          <button className="primary-button" disabled={busy}>
            {busy ? "Inviting…" : "Invite to workspace"}
          </button>
        </form>
      )}
      {notice && <p role="status">{notice}</p>}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </Modal>
  );
}
