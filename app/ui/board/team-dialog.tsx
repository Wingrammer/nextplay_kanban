"use client";

import { useState, type FormEvent } from "react";
import { boardRequest } from "@/app/lib/board-api";
import type { Workspace } from "@/app/lib/tasks";
import { Avatar, Icon, Modal } from "./primitives";

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
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const owner = workspace.user_id === workspace.board.owner_id;
  async function invite(values: Record<string, unknown>) {
    setBusy(true);
    setError("");
    setCopied(false);
    try {
      const result = await boardRequest<{ token: string }>(
        `boards/${workspace.board.id}/members`,
        "POST",
        values,
      );
      const url = new URL("/", window.location.origin);
      url.searchParams.set("invite", result.token);
      setLink(url.toString());
      await reload();
    } catch (value) {
      setError(value instanceof Error ? value.message : "Unable to invite member");
    } finally {
      setBusy(false);
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void invite({ name: form.get("name"), color: form.get("color") });
  }
  return (
    <Modal title="A small team, big ideas" close={close}>
      <p className="form-intro">
        Assign tasks to named members. An invitation connects their own guest account to this board.
      </p>
      <ul className="member-list">
        {workspace.members.map((member) => (
          <li key={member.id}>
            <Avatar member={member} />
            <div>
              <strong>{member.name}</strong>
              <span>{member.user_id ? "Connected" : "Not connected yet"}</span>
            </div>
            {owner && !member.user_id && (
              <button
                className="text-button"
                disabled={busy}
                onClick={() => void invite({ member_id: member.id, name: member.name })}
              >
                New invitation
              </button>
            )}
          </li>
        ))}
      </ul>
      {owner && (
        <form className="workspace-form" onSubmit={submit}>
          <div className="member-add">
            <label>
              Member name
              <input
                name="name"
                required
                maxLength={80}
                placeholder="e.g. Alex Chen"
                disabled={busy}
              />
            </label>
            <label>
              Color
              <input name="color" type="color" defaultValue="#71717a" disabled={busy} />
            </label>
          </div>
          <button className="primary-button" disabled={busy}>
            <Icon name="plus" size={15} />
            {busy ? "Creating..." : "Add member & create invitation"}
          </button>
        </form>
      )}
      {link && (
        <div className="invitation-result">
          <strong>Share this invitation privately</strong>
          <p>Single use. Expires in 7 days. Anyone holding this link can join this board.</p>
          <input
            aria-label="Invitation link"
            value={link}
            readOnly
            onFocus={(event) => event.currentTarget.select()}
          />
          <button
            className="secondary-button"
            onClick={() => {
              void navigator.clipboard
                .writeText(link)
                .then(() => setCopied(true))
                .catch(() => setError("Select and copy the invitation link manually."));
            }}
          >
            {copied ? "Copied" : "Copy invitation"}
          </button>
        </div>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </Modal>
  );
}
