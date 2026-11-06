"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { columns, type Status, type Task } from "@/app/lib/tasks";
import { Avatar, Icon, Modal } from "./board/primitives";
import { TaskCard, type DragPreview } from "./board/task-card";
import { TaskForm } from "./board/task-form";
import { TeamDialog } from "./board/team-dialog";
import { useBoard } from "./board/use-board";
import { TaskDiscussion } from "./board/task-discussion";
import { LabelsDialog } from "./board/labels-dialog";

// The shell owns view preferences; useBoard owns network state and reconciliation.
export default function SessionPanel() {
  const board = useBoard();
  const { workspace, loading, error, notice, saving } = board;
  const tasks = workspace?.tasks || [];
  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState("all");
  const [labelFilter, setLabelFilter] = useState("all");
  const [category, setCategory] = useState<Status | "all">("all");
  const [view, setView] = useState("board");
  const [modal, setModal] = useState<"task" | "team" | "account" | "labels" | null>(null);
  const [selected, setSelected] = useState<Task | undefined>();
  const [newStatus, setNewStatus] = useState<Status>("pending");
  const [drag, setDrag] = useState<DragPreview>(null);
  const [over, setOver] = useState<Status | null>(null);
  const [accountError, setAccountError] = useState("");
  const [accountBusy, setAccountBusy] = useState(false);
  const visible = tasks.filter(task => (category === "all" || task.status === category)
    && (priority === "all" || task.priority === priority)
    && (labelFilter === "all" || task.label_ids?.includes(labelFilter))
    && `${task.title} ${task.description || ""}`.toLowerCase().includes(query.toLowerCase()));
  const complete = tasks.filter(task => task.status === "completed").length;

  function openTask(task?: Task, status: Status = "pending") {
    setSelected(task); setNewStatus(status); setModal("task");
  }
  async function linkAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setAccountBusy(true); setAccountError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/link", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: form.get("email"), password: form.get("password") }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      board.setNotice(result.message); setModal(null);
    } catch (value) { setAccountError(value instanceof Error ? value.message : "Unable to link account"); }
    finally { setAccountBusy(false); }
  }

  return <div className="workspace-shell">
    <aside className="icon-rail" aria-label="Workspace navigation">
      <Link href="/" className="brand-mark" aria-label="Kanban home"><Icon name="folder" size={23} /></Link>
      <button className="rail-active icon-button" onClick={() => setView("board")} aria-label="Board view"><Icon name="board" size={21} /></button>
      <button className="icon-button" onClick={() => setModal("team")} disabled={!workspace} aria-label="Team"><Icon name="team" size={21} /></button>
      <div className="rail-spacer" /><span className="avatar">G</span>
    </aside>
    <aside className="workspace-sidebar">
      <div className="workspace-name"><strong>Your workspace</strong><span>A little space to make progress</span></div>
      <div className="sidebar-section"><p className="eyebrow">YOUR BOARDS</p>
        {workspace?.boards.map(item => <button key={item.id} className={`sidebar-link ${workspace.board.id === item.id ? "selected" : ""}`} onClick={() => void board.switchBoard(item.id)}><Icon name="folder" /><span>{item.name}</span></button>)}
      </div>
      <div className="sidebar-section"><p className="eyebrow">TASK CATEGORIES</p>
        {columns.map((column, index) => <button key={column.id} className={`sidebar-link ${category === column.id ? "selected" : ""}`} onClick={() => setCategory(category === column.id ? "all" : column.id)}><span className={`status-dot dot-${index}`} /><span>{column.label}</span><span className="sidebar-count">{tasks.filter(task => task.status === column.id).length}</span></button>)}
      </div>
      <div className="sidebar-section"><p className="eyebrow">THE TEAM</p>
        {workspace?.members.map(member => <div className="sidebar-link" key={member.id}><Avatar member={member} small /><span>{member.name}</span></div>)}
        <button className="sidebar-link" onClick={() => setModal("team")} disabled={!workspace}><Icon name="plus" size={16} /><span>Manage team</span></button>
      </div>
      <div className="sidebar-note"><Icon name="check" /><strong>One task at a time.</strong><p>Big ideas start with small steps.</p></div>
      <div className="sidebar-footer"><span className="avatar">G</span><div><strong>Your workspace</strong><span>{board.connection}</span></div></div>
    </aside>
    <div className="workspace-main">
      <header className="topbar">
        <nav aria-label="Breadcrumb"><span>Workspace</span><Icon name="chevron" size={12} /><strong>{workspace?.board.name || "Your board"}</strong></nav>
        <button className="account-button" disabled={!workspace} onClick={() => setModal("account")}><span className="avatar small">G</span><span>Save my account</span></button>
      </header>
      <main className="board-main">
        <div className="board-heading">
          <div><p className="eyebrow">YOUR IDEAS, IN MOTION</p><div className="board-title"><span className="board-symbol"><Icon name="folder" size={23} /></span><h1>{workspace?.board.name || "Personal board"}</h1></div><p className="board-description">A clear view of what&apos;s next. A little more room to focus.</p></div>
          <div className="heading-actions"><button className="team-button" onClick={() => setModal("team")} disabled={!workspace} aria-label="Manage team"><span className="avatar-stack">{workspace?.members.slice(0, 3).map(member => <Avatar key={member.id} member={member} small />)}</span><Icon name="team" size={17} /></button><button className="primary-button" disabled={!workspace} onClick={() => openTask()}><Icon name="plus" size={16} />New task</button></div>
        </div>
        <div className="mobile-board-select"><label>Board<select value={workspace?.board.id || ""} onChange={event => void board.switchBoard(event.target.value)}>{workspace?.boards.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div>
        <div className="board-toolbar">
          <div className="view-tabs">{["board", "list"].map(value => <button key={value} aria-pressed={view === value} className={view === value ? "active-view" : ""} onClick={() => setView(value)}><Icon name={value} size={16} />{value === "board" ? "Board" : "List"}</button>)}</div>
          <div className="toolbar-controls">
            <button className="icon-button" aria-label="Manage labels" disabled={!workspace} onClick={() => setModal("labels")}><Icon name="tag" size={16} /></button>
            <label className="search-box"><Icon name="search" size={16} /><input aria-label="Search tasks" placeholder="Search tasks..." value={query} onChange={event => setQuery(event.target.value)} /></label>
            <label className="filter-box"><select aria-label="Filter by priority" value={priority} onChange={event => setPriority(event.target.value)}><option value="all">All priorities</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label>
            <label className="filter-box"><select aria-label="Filter by label" value={labelFilter} onChange={event => setLabelFilter(event.target.value)}><option value="all">All labels</option>{workspace?.labels?.map(label => <option key={label.id} value={label.id}>{label.name}</option>)}</select></label>
            <button className="icon-button" aria-label="Refresh board" disabled={loading} onClick={() => void board.reload().catch(value => board.setError(value.message))}><Icon name="refresh" size={16} /></button>
          </div>
        </div>
        <div className="board-summary"><span>{loading ? "Opening your workspace..." : `${visible.length} tasks in this view`}</span><span>{complete} of {tasks.length} complete <span className="summary-track"><span style={{ width: `${tasks.length ? complete / tasks.length * 100 : 0}%` }} /></span><span className="live-status">{board.connection}</span></span></div>
        {error && <div className="error-banner" role="alert"><div><strong>We couldn&apos;t finish that request</strong><p>{error}</p></div><button className="text-button" onClick={() => { window.location.reload(); }}>Try again</button></div>}
        {view === "board" ? <div className="kanban-board" aria-busy={loading}>
          {columns.map((column, index) => <section key={column.id} data-column={column.id} className={`board-column ${drag && over === column.id ? "drop-active" : ""}`} aria-label={column.label}>
            <div className="column-heading"><span className={`status-dot dot-${index}`} /><h2>{column.label}</h2><span className="column-count">{visible.filter(task => task.status === column.id).length}</span><button className="icon-button" disabled={!workspace} onClick={() => openTask(undefined, column.id)} aria-label={`Add task to ${column.label}`}><Icon name="plus" size={16} /></button></div>
            <div className="column-body">
              {loading && !workspace ? [0, 1].map(value => <div className="task-skeleton" key={value}><span /><span /><span /></div>) : visible.filter(task => task.status === column.id).map(task => <TaskCard key={task.id} task={task} members={workspace?.members || []} labels={workspace?.labels || []} saving={saving.has(task.id)} dragging={drag?.task.id === task.id} edit={() => openTask(task)} move={status => void board.move(task, status)} preview={setDrag} hover={setOver} />)}
              {!loading && !visible.some(task => task.status === column.id) && <div className="column-empty"><span className="empty-icon"><Icon name={index === 3 ? "check" : "folder"} size={20} /></span><strong>{query || priority !== "all" ? "No matching tasks" : "A little room for progress"}</strong><p>{column.short}</p><button className="text-button" disabled={!workspace} onClick={() => openTask(undefined, column.id)}>Add a task <Icon name="plus" size={13} /></button></div>}
            </div>
          </section>)}
        </div> : <div className="task-list">{visible.map(task => <div className="list-row" key={task.id}><button onClick={() => openTask(task)}><Icon name="folder" /><span>{task.title}</span></button><span className="avatar-stack">{workspace?.members.filter(member => task.assignee_ids.includes(member.id)).map(member => <Avatar key={member.id} member={member} small />)}</span><select aria-label={`Move ${task.title} to`} value={task.status} disabled={saving.has(task.id)} onChange={event => void board.move(task, event.target.value as Status)}>{columns.map(column => <option key={column.id} value={column.id}>{column.label}</option>)}</select></div>)}{!visible.length && <div className="list-empty"><Icon name="folder" size={28} /><h2>A fresh start</h2><p>Add a task or adjust your filters.</p></div>}</div>}
        <footer className="board-footer"><span>Make space for what matters.</span><span>Drag by the handle, or use a task&apos;s status menu.</span></footer>
      </main>
    </div>
    {drag && <div className="drag-preview" style={{ left: drag.x + 14, top: drag.y + 12 }}><span className="eyebrow">MOVING TASK</span><strong>{drag.task.title}</strong><p>Drop into a column</p></div>}
    {notice && <div className="toast" role="status"><Icon name="check" size={16} /><span>{notice}</span><button aria-label="Dismiss notification" onClick={() => board.setNotice("")}><Icon name="close" size={14} /></button></div>}
    {modal === "team" && workspace && <TeamDialog workspace={workspace} close={() => setModal(null)} reload={board.reload} />}
    {modal === "labels" && workspace && <LabelsDialog workspace={workspace} close={() => setModal(null)} reload={board.reload} />}
    {modal === "task" && workspace && <Modal title={selected ? "Task details" : "A new little step"} wide={!!selected} close={() => setModal(null)}><TaskForm key={selected?.id || "new"} workspace={workspace} task={selected} status={newStatus} cancel={() => setModal(null)} saved={() => { setModal(null); board.setNotice("Task saved."); void board.reload(); }} />{selected && <TaskDiscussion workspace={workspace} task={selected} />}</Modal>}
    {modal === "account" && <Modal title="Make this space yours" close={() => setModal(null)}><form className="workspace-form" onSubmit={linkAccount}><p className="form-intro">Keep this workspace by linking your guest account to an email and password.</p><label>Email<input type="email" name="email" required autoComplete="email" disabled={accountBusy} /></label><label>Password<input type="password" name="password" required minLength={8} maxLength={256} autoComplete="new-password" disabled={accountBusy} /></label>{accountError && <p role="alert" className="form-error">{accountError}</p>}<div className="form-actions"><button type="button" className="secondary-button" onClick={() => setModal(null)}>Cancel</button><button className="primary-button" disabled={accountBusy}>{accountBusy ? "Saving..." : "Save my account"}</button></div></form></Modal>}
  </div>;
}
