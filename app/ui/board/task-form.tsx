"use client";

import { useState, type FormEvent } from "react";
import { boardRequest } from "@/app/lib/board-api";
import { columns, type Status, type Task, type Workspace } from "@/app/lib/tasks";
import { Avatar } from "./primitives";

export function TaskForm({ workspace, task, status, saved, cancel }: { workspace: Workspace; task?: Task; status: Status; saved: () => void; cancel: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    const values = {
      title: String(form.get("title")).trim(), description: String(form.get("description")),
      status: form.get("status"), priority: form.get("priority"), assignee_ids: form.getAll("assignees"),
    };
    try {
      await boardRequest(`boards/${workspace.board.id}/tasks${task ? `/${task.id}` : ""}`, task ? "PATCH" : "POST", values);
      saved();
    } catch (value) { setError(value instanceof Error ? value.message : "Unable to save task"); }
    finally { setBusy(false); }
  }
  return <form className="workspace-form" onSubmit={submit}>
    <p className="form-intro">Give your task a name, a place, and the people who will bring it to life.</p>
    <label>Task name<input name="title" defaultValue={task?.title} required maxLength={160} placeholder="What would you like to work on?" disabled={busy} autoFocus /></label>
    <label>Description<textarea name="description" defaultValue={task?.description} rows={3} maxLength={4000} placeholder="A little context goes a long way..." disabled={busy} /></label>
    <div className="form-grid">
      <label>Status<select name="status" defaultValue={task?.status || status} disabled={busy}>{columns.map(column => <option key={column.id} value={column.id}>{column.label}</option>)}</select></label>
      <label>Priority<select name="priority" defaultValue={task?.priority || "medium"} disabled={busy}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
    </div>
    <fieldset disabled={busy} className="assignee-picker"><legend>Assignees</legend>
      {workspace.members.map(member => <label key={member.id}><input type="checkbox" name="assignees" value={member.id} defaultChecked={task?.assignee_ids.includes(member.id)} /><Avatar member={member} small /><span>{member.name}</span></label>)}
    </fieldset>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="form-actions"><button type="button" className="secondary-button" disabled={busy} onClick={cancel}>Cancel</button><button className="primary-button" disabled={busy}>{busy ? "Saving..." : task ? "Save changes" : "Create task"}</button></div>
  </form>;
}
