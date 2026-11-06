"use client";

import { useRef } from "react";
import { columns, type Label, type Member, type Status, type Task } from "@/app/lib/tasks";
import { Avatar, Icon } from "./primitives";

export type DragPreview = { task: Task; x: number; y: number } | null;
type Props = { task: Task; members: Member[]; labels: Label[]; saving: boolean; dragging: boolean; edit: () => void; move: (status: Status) => void; preview: (value: DragPreview) => void; hover: (status: Status | null) => void };

export function TaskCard({ task, members, labels, saving, dragging, edit, move, preview, hover }: Props) {
  const pointer = useRef({ x: 0, y: 0, active: false });
  const stage = columns.findIndex(column => column.id === task.status);
  const assigned = members.filter(member => task.assignee_ids.includes(member.id));
  return <article className={`task-card ${dragging ? "is-dragging" : ""} ${saving ? "is-saving" : ""}`}>
    <div className="card-top">
      <span className={`priority priority-${task.priority || "medium"}`}><span className="priority-dot" />{task.priority || "medium"} priority</span>
      <button className="drag-handle" disabled={saving} aria-label={`Drag ${task.title}. Left and right arrows move between columns.`}
        onPointerDown={event => {
          if (event.button !== 0) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          pointer.current = { x: event.clientX, y: event.clientY, active: false };
        }}
        onPointerMove={event => {
          if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
          const distance = Math.abs(event.clientX - pointer.current.x) + Math.abs(event.clientY - pointer.current.y);
          pointer.current.active ||= distance > 6;
          if (!pointer.current.active) return;
          preview({ task, x: event.clientX, y: event.clientY });
          const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-column]");
          hover(target?.dataset.column as Status || null);
          const board = event.currentTarget.closest(".kanban-board");
          if (board) {
            const bounds = board.getBoundingClientRect();
            if (event.clientX > bounds.right - 35) board.scrollBy(14, 0);
            if (event.clientX < bounds.left + 35) board.scrollBy(-14, 0);
          }
        }}
        onPointerUp={event => {
          const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-column]");
          // This is the only pointer handler that performs a network mutation.
          if (pointer.current.active && target?.dataset.column) move(target.dataset.column as Status);
          preview(null); hover(null); pointer.current.active = false;
        }}
        onPointerCancel={() => { preview(null); hover(null); pointer.current.active = false; }}
        onKeyDown={event => {
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
          event.preventDefault();
          const next = columns[stage + (event.key === "ArrowRight" ? 1 : -1)];
          if (next) move(next.id);
        }}><Icon name="grip" size={16} /></button>
    </div>
    <button className="card-content" onClick={edit} disabled={saving}>
      <h3>{task.title}</h3><p>{task.description || "Add a little context to this task."}</p>
    </button>
    <div className="task-labels">{labels.filter(label => task.label_ids?.includes(label.id)).map(label => <span key={label.id} className="task-label" style={{ borderColor: label.color }}>{label.name}</span>)}</div>
    <div className="card-progress"><span>Stage</span><span>{stage + 1}/4</span></div>
    <div className="progress-segments">{columns.map((column, index) => <span key={column.id} className={index <= stage ? "filled" : ""} />)}</div>
    <div className="card-bottom">
      <div className="avatar-stack">{assigned.length ? assigned.map(member => <Avatar key={member.id} member={member} small />) : <span className="muted tiny">Unassigned</span>}</div>
      <select aria-label={`Move ${task.title} to`} value={task.status} disabled={saving} onChange={event => move(event.target.value as Status)}>
        {columns.map(column => <option key={column.id} value={column.id}>{column.label}</option>)}
      </select>
    </div>
  </article>;
}
