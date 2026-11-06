"use client";

import { useEffect, useState, type FormEvent } from "react";
import { boardRequest } from "@/app/lib/board-api";
import type { Task, Workspace } from "@/app/lib/tasks";
import { Icon } from "./primitives";

type Comment = { id: string; author_name: string; body: string; created_at: string };
type Details = { comments: Comment[] };

export function TaskDiscussion({ workspace, task }: { workspace: Workspace; task: Task }) {
  const [details, setDetails] = useState<Details | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const path = `boards/${workspace.board.id}/tasks/${task.id}`;

  // A board revision changes when another member posts. Refetch details without
  // resetting the draft comment or the unsaved task form beside it.
  useEffect(() => {
    let active = true;
    void boardRequest<Details>(path).then(result => { if (active) { setDetails(result); setError(""); } }).catch(value => { if (active) setError(value.message); });
    return () => { active = false; };
  }, [path, workspace.board.revision]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      await boardRequest(`${path}/comments`, "POST", { body: text.trim() });
      setText("");
      setDetails(await boardRequest<Details>(path));
    } catch (value) { setError(value instanceof Error ? value.message : "Unable to post comment"); }
    finally { setBusy(false); }
  }
  return <section className="task-discussion" aria-label="Task comments">
    <h3><Icon name="comment" size={17} />Discussion</h3>
    {error && <p className="form-error" role="alert">{error}</p>}
    {!details && !error && <p className="muted">Loading discussion...</p>}
    {details && !details.comments.length && <p className="discussion-empty">Start the conversation. A little context helps everyone.</p>}
    <ol className="comment-list">{details?.comments.map(comment => <li key={comment.id}>
      <div><strong>{comment.author_name}</strong><time dateTime={comment.created_at}>{new Date(comment.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</time></div>
      <p>{comment.body}</p>
    </li>)}</ol>
    <form className="workspace-form" onSubmit={submit}>
      <label>Add a comment<textarea value={text} onChange={event => setText(event.target.value)} required maxLength={2000} rows={3} placeholder="Share an update or ask a question..." disabled={busy} /></label>
      <button className="secondary-button" disabled={busy || !text.trim()}>{busy ? "Posting..." : "Post comment"}</button>
    </form>
  </section>;
}
