"use client";

import { useState, type FormEvent } from "react";
import { boardRequest } from "@/app/lib/board-api";
import type { Workspace } from "@/app/lib/tasks";
import { Modal } from "./primitives";

export function LabelsDialog({
  workspace,
  close,
  reload,
}: {
  workspace: Workspace;
  close: () => void;
  reload: () => Promise<void>;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const element = event.currentTarget;
    const form = new FormData(element);
    try {
      await boardRequest(`boards/${workspace.board.id}/labels`, "POST", {
        name: form.get("name"),
        color: form.get("color"),
      });
      element.reset();
      await reload();
    } catch (value) {
      setError(value instanceof Error ? value.message : "Unable to create label");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="A little organization" close={close}>
      <p className="form-intro">
        Create labels, add several to a task, and filter the board by what matters.
      </p>
      <div className="task-labels label-library">
        {workspace.labels?.map((label) => (
          <span key={label.id} className="task-label" style={{ borderColor: label.color }}>
            {label.name}
          </span>
        ))}
        {!workspace.labels?.length && (
          <p className="muted">No labels yet. Try Design, Feature, or Bug.</p>
        )}
      </div>
      <form className="workspace-form" onSubmit={submit}>
        <div className="member-add">
          <label>
            Label name
            <input name="name" required maxLength={32} placeholder="e.g. Design" disabled={busy} />
          </label>
          <label>
            Color
            <input name="color" type="color" defaultValue="#71717a" disabled={busy} />
          </label>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="primary-button" disabled={busy}>
          {busy ? "Creating..." : "Create label"}
        </button>
      </form>
    </Modal>
  );
}
