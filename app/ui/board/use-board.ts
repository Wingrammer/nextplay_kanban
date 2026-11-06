"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { boardRequest, ensureGuest } from "@/app/lib/board-api";
import { finishAuthReturn } from "@/app/lib/auth-return";
import { subscribeBoard } from "@/app/lib/board-stream";
import { normalizeStatus, type Status, type Task, type Workspace } from "@/app/lib/tasks";

export function useBoard() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [account, setAccount] = useState<{
    email: string;
    confirmed: boolean;
    password_configured: boolean;
  } | null>(null);
  const refreshAccount = useCallback(async () => {
    const response = await fetch("/api/auth/account", {
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Unable to verify your account");
    setAccount(result);
  }, []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [connection, setConnection] = useState("Connecting");
  const [streamGeneration, setStreamGeneration] = useState(0);
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const boardID = useRef<string | null>(null);
  const requestNumber = useRef(0);
  const optimistic = useRef(new Map<string, Status>());

  const reload = useCallback(async (id?: string) => {
    const requested = id ?? boardID.current;
    const sequence = ++requestNumber.current;
    const result = await boardRequest<Workspace>(
      `workspace${requested ? `?board=${encodeURIComponent(requested)}` : ""}`,
    );
    if (sequence !== requestNumber.current) return;
    boardID.current = result.board.id;
    result.tasks = result.tasks.map((task) => ({
      ...task,
      status: optimistic.current.get(task.id) || normalizeStatus(task.status),
      assignee_ids: task.assignee_ids || [],
    }));
    setWorkspace(result);
    setError("");
  }, []);

  useEffect(() => {
    let active = true;
    async function initialize() {
      await finishAuthReturn();
      await ensureGuest();
      await refreshAccount();
      const url = new URL(window.location.href);
      let selected = window.localStorage.getItem("kanban_board") || undefined;
      if (url.searchParams.has("invite")) {
        try {
          selected = await boardRequest<string>("invitations/accept", "POST", {
            token: url.searchParams.get("invite"),
          });
          setNotice("You joined the board. Welcome to the team!");
        } catch (value) {
          selected = undefined;
          setNotice(
            `Invitation unavailable: ${value instanceof Error ? value.message : "please request a new link"}. Your personal board is open.`,
          );
        }
        url.searchParams.delete("invite");
        window.history.replaceState(null, "", url.pathname + url.search);
      }
      if (!active) return;
      try {
        await reload(selected);
      } catch {
        await reload("");
      }
    }
    void initialize()
      .catch((value) => {
        if (active)
          setError(value instanceof Error ? value.message : "Unable to open your workspace");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reload, refreshAccount]);

  useEffect(() => {
    // Confirmation may happen in a second tab. Re-read Auth when this tab regains focus.
    const focus = () => {
      void refreshAccount().catch(() => {});
    };
    window.addEventListener("focus", focus);
    return () => window.removeEventListener("focus", focus);
  }, [refreshAccount]);

  // SSE carries invalidations after committed writes, never drag coordinates.
  // Reconnect always reloads a snapshot, which repairs events missed offline.
  useEffect(() => {
    const id = workspace?.board.id;
    if (!id) return;
    window.localStorage.setItem("kanban_board", id); // Only a board ID, never tokens.
    const reconcile = () => {
      void reload().catch(() => setConnection("Reconnecting"));
    };
    const stop = subscribeBoard(id, workspace.user_id, (event) => {
      if (event === "ready") {
        setConnection("Live");
        reconcile();
      }
      if (event === "board_changed") reconcile();
      if (event === "stream_error") setConnection("Reconnecting");
      if (event === "access_changed") {
        setConnection("Access changed");
        void reload("").catch((value) => setError(value.message));
      }
      if (event === "session_expired") {
        void ensureGuest()
          .then(() => setStreamGeneration((value) => value + 1))
          .catch((value) => setError(value.message));
      }
    });
    return stop;
  }, [workspace?.board.id, workspace?.user_id, streamGeneration, reload]);

  async function move(task: Task, status: Status) {
    if (optimistic.current.has(task.id) || task.status === status || !workspace) return;
    optimistic.current.set(task.id, status);
    setSaving((current) => new Set(current).add(task.id));
    setWorkspace(
      (current) =>
        current && {
          ...current,
          tasks: current.tasks.map((value) =>
            value.id === task.id ? { ...value, status } : value,
          ),
        },
    );
    try {
      await boardRequest(`boards/${workspace.board.id}/tasks/${task.id}`, "PATCH", { status });
      setNotice("Task moved.");
    } catch (value) {
      setError(value instanceof Error ? value.message : "Move could not be saved");
      setWorkspace(
        (current) =>
          current && {
            ...current,
            tasks: current.tasks.map((item) => (item.id === task.id ? task : item)),
          },
      );
    } finally {
      optimistic.current.delete(task.id);
      setSaving((current) => {
        const next = new Set(current);
        next.delete(task.id);
        return next;
      });
      // Last-write-wins: reload the authoritative state, including another user's drop.
      void reload().catch(() => setConnection("Reconnecting"));
    }
  }

  async function switchBoard(id: string) {
    setLoading(true);
    try {
      await reload(id);
    } catch (value) {
      setError(value instanceof Error ? value.message : "Unable to open board");
    } finally {
      setLoading(false);
    }
  }
  return {
    workspace,
    account,
    refreshAccount,
    loading,
    error,
    notice,
    connection,
    saving,
    move,
    reload,
    switchBoard,
    setError,
    setNotice,
  };
}
