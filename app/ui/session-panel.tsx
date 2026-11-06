"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { columns, normalizeStatus, type Status, type Task } from "@/app/lib/tasks";

async function request(path: string, init?: RequestInit) {
  const response = await fetch(path, { ...init, cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Something went wrong. Please try again.");
  return data;
}
const post = (data: unknown) => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
// Share initialization during React Strict Mode remounts, without creating extra guests.
let opening: Promise<{ userId: string }> | null = null;
function openWorkspace() {
  if (!opening) opening = request("/api/auth/guest", { method: "POST" }).finally(() => { opening = null; });
  return opening!;
}

async function fetchWorkspace(): Promise<Task[]> {
  await openWorkspace();
  const result = await request("/api/tasks");
  if (result !== null && !Array.isArray(result)) throw new Error("The task service returned an unexpected response.");
  return (result || []).map((task: Task) => ({ ...task, status: normalizeStatus(task.status) }));
}

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const paths: Record<string, string> = {
    board: "M3 4h18v16H3z M9 4v16 M15 4v16 M5 8h2 M11 8h2 M17 8h2",
    grid: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
    list: "M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01",
    plus: "M12 5v14 M5 12h14", search: "M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
    chevron: "m9 5 7 7-7 7", close: "m6 6 12 12 M6 18 18 6",
    filter: "M4 7h16 M7 12h10 M10 17h4", folder: "M3 6h6l2 2h10v12H3z",
    check: "m5 12 4 4L19 6", refresh: "M20 7v5h-5 M4 17v-5h5 M5 8a8 8 0 0 1 13-3l2 3 M19 16a8 8 0 0 1-13 3l-2-3",
    grip: "M9 5h.01 M15 5h.01 M9 12h.01 M15 12h.01 M9 19h.01 M15 19h.01",
    account: "M20 21v-2a7 7 0 0 0-14 0v2 M17 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
    arrow: "M5 12h14 m-5-5 5 5-5 5", alert: "M12 8v5 M12 17h.01 M12 2 2 21h20z",
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.board} /></svg>;
}

function Modal({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} className="workspace-dialog" aria-labelledby={id} onCancel={close} onClick={e => { if (e.target === e.currentTarget) close(); }}>
    <div className="dialog-heading"><h2 id={id}>{title}</h2><button className="icon-button" onClick={close} aria-label="Close dialog"><Icon name="close" /></button></div>
    {children}
  </dialog>;
}

export default function SessionPanel() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState("all");
  const [category, setCategory] = useState<Status | "all">("all");
  const [view, setView] = useState("board");
  const [modal, setModal] = useState<"task" | "account" | null>(null);
  const [editing, setEditing] = useState<Task | null>(null);
  const [newStatus, setNewStatus] = useState<Status>("pending");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [drag, setDrag] = useState<{ id: string; x: number; y: number; active: boolean } | null>(null);
  const [over, setOver] = useState<Status | null>(null);
  const dragStart = useRef({ x: 0, y: 0 });

  async function load() {
    setLoading(true); setError("");
    try {
      setTasks(await fetchWorkspace());
      setReady(true);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to open your workspace."); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    let active = true;
    void fetchWorkspace().then(result => {
      if (active) { setTasks(result); setReady(true); }
    }).catch(e => {
      if (active) setError(e instanceof Error ? e.message : "Unable to open your workspace.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  function newTask(status: Status = "pending") {
    setEditing(null); setNewStatus(status); setFormError(""); setModal("task");
  }
  function editTask(task: Task) { setEditing(task); setFormError(""); setModal("task"); }

  async function move(task: Task, status: Status) {
    if (task.status === status || saving.has(task.id)) return;
    setError("");
    setSaving(current => new Set(current).add(task.id));
    setTasks(current => current.map(t => t.id === task.id ? { ...t, status } : t));
    try {
      await request(`/api/tasks/${encodeURIComponent(task.id)}`, { ...post({ status }), method: "PATCH" });
      setNotice(`Moved “${task.title}” to ${columns.find(c => c.id === status)?.label}.`);
    } catch (e) {
      setTasks(current => current.map(t => t.id === task.id ? { ...t, status: task.status } : t));
      setError(e instanceof Error ? e.message : "Move could not be saved. Your task was put back.");
    } finally { setSaving(current => { const next = new Set(current); next.delete(task.id); return next; }); }
  }

  async function saveTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setFormError("");
    const form = new FormData(event.currentTarget);
    const values = { title: String(form.get("title")).trim(), description: String(form.get("description")), priority: String(form.get("priority")), status: String(form.get("status")) };
    try {
      const task = await request(editing ? `/api/tasks/${encodeURIComponent(editing.id)}` : "/api/tasks", {
        ...post(editing ? values : { ...values, id: crypto.randomUUID() }), method: editing ? "PATCH" : "POST",
      });
      const normalized = { ...task, status: normalizeStatus(task.status) };
      setTasks(current => editing ? current.map(t => t.id === editing.id ? normalized : t) : [...current, normalized]);
      setModal(null); setNotice(editing ? "Task updated." : "Your new task is ready.");
    } catch (e) { setFormError(e instanceof Error ? e.message : "Unable to save task."); }
    finally { setBusy(false); }
  }

  async function link(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setFormError("");
    const form = new FormData(event.currentTarget);
    try {
      const result = await request("/api/auth/link", post({ email: form.get("email"), password: form.get("password") }));
      setModal(null); setNotice(result.message);
    } catch (e) { setFormError(e instanceof Error ? e.message : "Unable to save account."); }
    finally { setBusy(false); }
  }

  const visible = tasks.filter(t => (category === "all" || category === t.status) && (priority === "all" || t.priority === priority) && `${t.title} ${t.description || ""}`.toLowerCase().includes(query.toLowerCase()));
  const complete = tasks.filter(t => t.status === "completed").length;
  const dragged = drag?.active ? tasks.find(t => t.id === drag.id) : null;

  function card(task: Task) {
    return <article key={task.id} className={`task-card ${dragged?.id === task.id ? "is-dragging" : ""} ${saving.has(task.id) ? "is-saving" : ""}`}>
      <div className="card-top"><span className={`priority priority-${task.priority || "medium"}`}><span className="priority-dot" />{task.priority || "medium"} priority</span>
        <button className="drag-handle" aria-label={`Drag ${task.title}. Use left and right arrows to move between columns.`} disabled={saving.has(task.id)}
          onPointerDown={e => { if (e.button !== 0) return; e.currentTarget.setPointerCapture(e.pointerId); dragStart.current = { x: e.clientX, y: e.clientY }; setDrag({ id: task.id, x: e.clientX, y: e.clientY, active: false }); }}
          onPointerMove={e => {
            if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
            const active = Math.abs(e.clientX - dragStart.current.x) + Math.abs(e.clientY - dragStart.current.y) > 6;
            setDrag(previous => ({ id: task.id, x: e.clientX, y: e.clientY, active: !!previous?.active || active }));
            const target = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-column]");
            setOver(target?.dataset.column as Status || null);
          }}
          onPointerUp={e => {
            const target = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-column]")?.dataset.column as Status;
            if (drag?.active && target) void move(task, target);
            setDrag(null); setOver(null);
          }}
          onPointerCancel={() => { setDrag(null); setOver(null); }}
          onKeyDown={e => { if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return; e.preventDefault(); const index = columns.findIndex(c => c.id === task.status); const next = columns[index + (e.key === "ArrowRight" ? 1 : -1)]; if (next) void move(task, next.id); }}>
          <Icon name="grip" size={16} />
        </button>
      </div>
      <button className="card-content" onClick={() => editTask(task)} disabled={saving.has(task.id)}><h3>{task.title}</h3><p>{task.description || "Add a description to give this task a little context."}</p></button>
      <div className="card-progress"><span>Progress</span><span>{columns.findIndex(c => c.id === task.status) + 1}/4</span></div>
      <div className="progress-segments">{columns.map((c, index) => <span key={c.id} className={index <= columns.findIndex(c => c.id === task.status) ? "filled" : ""} />)}</div>
      <div className="card-bottom"><span className="avatar small" title="Your task">Y</span><label className="move-label"><span className="sr-only">Move {task.title} to</span><select aria-label={`Move ${task.title} to`} value={task.status} disabled={saving.has(task.id)} onChange={e => void move(task, e.target.value as Status)}>{columns.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label></div>
    </article>;
  }

  return <div className="workspace-shell">
    <aside className="icon-rail" aria-label="Workspace navigation"><Link href="/" className="brand-mark" aria-label="Kanban home"><Icon name="board" size={23} /></Link><button className="rail-active icon-button" aria-label="Show all tasks" onClick={() => { setCategory("all"); setView("board"); }}><Icon name="grid" size={21} /></button><button className="icon-button" aria-label="Show task list" onClick={() => setView("list")}><Icon name="list" size={21} /></button><div className="rail-spacer" /><span className="avatar" title="Your guest workspace">G</span></aside>
    <aside className="workspace-sidebar">
      <div className="workspace-name"><div><strong>Personal workspace</strong><span>A little space to make progress</span></div></div>
      <div className="sidebar-section"><p className="eyebrow">WORKSPACE</p><button className={`sidebar-link ${category === "all" ? "selected" : ""}`} onClick={() => setCategory("all")}><Icon name="folder" /><span>My projects</span><Icon name="chevron" size={13} /></button><button className="sidebar-project" onClick={() => { setCategory("all"); setView("board"); }}><Icon name="board" size={16} />Personal board<span className="sidebar-count">{tasks.length}</span></button></div>
      <div className="sidebar-section"><p className="eyebrow">TASK CATEGORIES</p>{columns.map((column, index) => <button key={column.id} className={`sidebar-link ${category === column.id ? "selected" : ""}`} onClick={() => setCategory(category === column.id ? "all" : column.id)}><span className={`status-dot dot-${index}`} /><span>{column.label}</span><span className="sidebar-count">{tasks.filter(t => t.status === column.id).length}</span></button>)}</div>
      <div className="sidebar-note"><Icon name="check" size={21} /><strong>One task at a time.</strong><p>Big ideas start with small steps. You’ve got this.</p></div>
      <div className="sidebar-footer"><span className="avatar">G</span><div><strong>Your workspace</strong><span>{ready ? "Guest session connected" : loading ? "Connecting…" : "Connection needs attention"}</span></div></div>
    </aside>
    <div className="workspace-main">
      <header className="topbar"><nav aria-label="Breadcrumb"><span>Workspace</span><Icon name="chevron" size={12} /><span>Projects</span><Icon name="chevron" size={12} /><strong>Personal board</strong></nav><button className="account-button" disabled={!ready} onClick={() => { setFormError(""); setModal("account"); }}><span className="avatar small">G</span><span>Guest workspace</span><Icon name="chevron" size={12} /></button></header>
      <main className="board-main">
        <div className="board-heading"><div><p className="eyebrow">YOUR IDEAS, IN MOTION</p><div className="board-title"><span className="board-symbol"><Icon name="board" size={23} /></span><h1>Personal board</h1></div><p className="board-description">A clear view of what’s next. A little more room to focus.</p></div><button className="primary-button" disabled={!ready} onClick={() => newTask()}><Icon name="plus" size={17} />New task</button></div>
        <div className="board-toolbar"><div className="view-tabs" role="tablist" aria-label="Task view"><button id="board-tab" role="tab" aria-selected={view === "board"} aria-controls="tasks-panel" onClick={() => setView("board")}><Icon name="board" size={16} />Board</button><button id="list-tab" role="tab" aria-selected={view === "list"} aria-controls="tasks-panel" onClick={() => setView("list")}><Icon name="list" size={16} />List</button></div><div className="toolbar-controls"><label className="search-box"><Icon name="search" size={16} /><input aria-label="Search tasks" placeholder="Search tasks…" value={query} onChange={e => setQuery(e.target.value)} />{query && <button aria-label="Clear search" onClick={() => setQuery("")}><Icon name="close" size={13} /></button>}</label><label className="filter-box"><Icon name="filter" size={15} /><select aria-label="Filter by priority" value={priority} onChange={e => setPriority(e.target.value)}><option value="all">Filter</option><option value="high">High priority</option><option value="medium">Medium priority</option><option value="low">Low priority</option></select></label><button className="icon-button refresh-button" disabled={loading} onClick={() => void load()} aria-label="Refresh tasks"><Icon name="refresh" size={16} /></button></div></div>
        <div className="board-summary"><span>{loading ? "Opening your workspace…" : `${visible.length} ${visible.length === 1 ? "task" : "tasks"}${category !== "all" || priority !== "all" || query ? " in this view" : " in your workspace"}`}</span><span>{complete} of {tasks.length} complete <span className="summary-track"><span style={{ width: `${tasks.length ? complete / tasks.length * 100 : 0}%` }} /></span></span></div>
        {error && <div className="error-banner" role="alert"><Icon name="alert" /><div><strong>{ready ? "That didn’t go as planned" : "We couldn’t open your workspace"}</strong><p>{error}</p></div><button className="text-button" onClick={() => void load()} disabled={loading}>Try again <Icon name="refresh" size={14} /></button></div>}
        <div id="tasks-panel" role="tabpanel" aria-labelledby={view === "board" ? "board-tab" : "list-tab"} aria-busy={loading}>
          {view === "board" ? <div className="kanban-board">{columns.map((column, index) => <section key={column.id} className={`board-column ${over === column.id && dragged ? "drop-active" : ""}`} data-column={column.id} aria-label={column.label}>
            <div className="column-heading"><span className={`status-dot dot-${index}`} /><h2>{column.label}</h2><span className="column-count">{visible.filter(t => t.status === column.id).length}</span><button className="icon-button" disabled={!ready} onClick={() => newTask(column.id)} aria-label={`Add task to ${column.label}`}><Icon name="plus" size={16} /></button></div>
            <div className="column-body">{loading && !ready ? [0, 1].map(n => <div className="task-skeleton" key={n}><span /><span /><span /></div>) : <>{visible.filter(t => t.status === column.id).map(card)}{!visible.some(t => t.status === column.id) && <div className="column-empty"><span className="empty-icon"><Icon name={index === 3 ? "check" : "plus"} size={20} /></span><strong>{query || priority !== "all" || category !== "all" ? "No matching tasks" : "A little room for progress"}</strong><p>{query || priority !== "all" || category !== "all" ? "Try another search or clear your filters." : column.short}</p><button className="text-button" disabled={!ready} onClick={() => newTask(column.id)}>Add a task <Icon name="plus" size={13} /></button></div>}</>}</div>
          </section>)}</div> : <div className="task-list">{visible.length ? visible.map(task => <div key={task.id} className="list-row"><button onClick={() => editTask(task)} disabled={saving.has(task.id)}><Icon name={task.status === "completed" ? "check" : "board"} size={17} /><span>{task.title}</span></button><span className="list-priority">{task.priority || "medium"}</span><select aria-label={`Move ${task.title} to`} value={task.status} disabled={saving.has(task.id)} onChange={e => void move(task, e.target.value as Status)}>{columns.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select></div>) : <div className="list-empty"><Icon name="list" size={28} /><h2>{loading ? "Loading your tasks…" : "A fresh start"}</h2><p>{query ? "No tasks match your search." : "Your next idea belongs here. Add a task to get started."}</p></div>}</div>}
        </div>
        <footer className="board-footer"><span>Make space for what matters.</span><span>Drag by the handle, or use a task’s status menu to move it.</span></footer>
      </main>
    </div>
    <div className="sr-only" role="status" aria-live="polite">{notice}</div>
    {notice && <div className="toast" role="status"><Icon name="check" size={16} /><span>{notice}</span><button aria-label="Dismiss notification" onClick={() => setNotice("")}><Icon name="close" size={14} /></button></div>}
    {dragged && drag && <div className="drag-preview" style={{ left: drag.x + 14, top: drag.y + 12 }}><span className="eyebrow">MOVING TASK</span><strong>{dragged.title}</strong><p>Drop into a column</p></div>}
    {modal === "task" && <Modal title={editing ? "Edit task" : "A new little step"} close={() => setModal(null)}><form onSubmit={saveTask} className="workspace-form"><p className="form-intro">Give your task a name and a place to begin.</p><label>Task name<input name="title" placeholder="What would you like to work on?" defaultValue={editing?.title} required maxLength={160} disabled={busy} autoFocus /></label><label>Description<textarea name="description" placeholder="A little context goes a long way…" defaultValue={editing?.description} maxLength={4000} rows={4} disabled={busy} /></label><div className="form-grid"><label>Status<select name="status" defaultValue={editing?.status || newStatus} disabled={busy}>{columns.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label><label>Priority<select name="priority" defaultValue={editing?.priority || "medium"} disabled={busy}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label></div>{formError && <p className="form-error" role="alert">{formError}</p>}<div className="form-actions"><button type="button" className="secondary-button" disabled={busy} onClick={() => setModal(null)}>Cancel</button><button className="primary-button" disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Create task"}<Icon name="arrow" size={15} /></button></div></form></Modal>}
    {modal === "account" && <Modal title="Make this space yours" close={() => setModal(null)}><form onSubmit={link} className="workspace-form"><p className="form-intro">Link an email and password to keep the same workspace and everything you’ve started.</p><label>Email<input name="email" type="email" placeholder="you@example.com" autoComplete="email" required disabled={busy} autoFocus /></label><label>Password<input name="password" type="password" placeholder="At least 8 characters" autoComplete="new-password" minLength={8} maxLength={256} required disabled={busy} /></label>{formError && <p className="form-error" role="alert">{formError}</p>}<div className="form-actions"><button type="button" className="secondary-button" disabled={busy} onClick={() => setModal(null)}>Maybe later</button><button className="primary-button" disabled={busy}>{busy ? "Saving…" : "Save my account"}<Icon name="arrow" size={15} /></button></div></form></Modal>}
  </div>;
}
