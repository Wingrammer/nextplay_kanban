"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import type { Member } from "@/app/lib/tasks";

export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const paths: Record<string, string> = {
    board: "M3 4h18v16H3z M9 4v16 M15 4v16 M5 8h2 M11 8h2 M17 8h2",
    list: "M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01",
    plus: "M12 5v14 M5 12h14",
    search: "M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
    chevron: "m9 5 7 7-7 7",
    close: "m6 6 12 12 M6 18 18 6",
    folder: "M3 6h6l2 2h10v12H3z",
    check: "m5 12 4 4L19 6",
    refresh: "M20 7v5h-5 M4 17v-5h5 M5 8a8 8 0 0 1 13-3l2 3 M19 16a8 8 0 0 1-13 3l-2-3",
    grip: "M9 5h.01 M15 5h.01 M9 12h.01 M15 12h.01 M9 19h.01 M15 19h.01",
    team: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M20 21v-2a4 4 0 0 0-3-4 M16 3a4 4 0 0 1 0 8",
    comment: "M21 11a9 9 0 0 1-9 9H3l1-5a9 9 0 1 1 17-4z",
    clock: "M12 8v4l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
    tag: "M3 3h8l10 10-8 8L3 11z M7 7h.01",
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] || paths.board} />
    </svg>
  );
}

export function Avatar({ member, small = false }: { member: Member; small?: boolean }) {
  const initials = member.name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span
      className={`avatar ${small ? "small" : ""}`}
      style={{ borderColor: member.color }}
      title={member.name}
      aria-label={member.name}
    >
      {initials}
    </span>
  );
}

// A native dialog supplies focus trapping and Escape handling. Explicit insets
// keep it centered inside mobile viewports as well as the desktop workspace.
export function Modal({
  title,
  close,
  children,
  wide = false,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`workspace-dialog ${wide ? "detail-dialog" : ""}`}
      aria-labelledby={id}
      onCancel={close}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="dialog-heading">
        <h2 id={id}>{title}</h2>
        <button className="icon-button" onClick={close} aria-label="Close dialog">
          <Icon name="close" />
        </button>
      </div>
      {children}
    </dialog>
  );
}
