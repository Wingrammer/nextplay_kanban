const events = [
  "ready",
  "board_changed",
  "stream_error",
  "access_changed",
  "session_expired",
  "reconnect",
];

// HTTP/1 browsers permit only a few connections per origin. A Web Lock elects
// one tab to own each board stream; BroadcastChannel shares invalidations with
// sibling tabs. No credentials or task contents cross this channel.
export function subscribeBoard(board: string, user: string, receive: (event: string) => void) {
  const name = `kanban:${user}:${board}`;
  let abort = new AbortController();
  let stopped = false;
  let source: EventSource | undefined;
  let release: (() => void) | undefined;
  let status = "stream_error";
  const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(name);
  const shared = channel && navigator.locks;
  const notify = (event: string) => {
    status = event === "board_changed" ? status : event;
    receive(event);
    channel?.postMessage(event);
  };
  channel?.addEventListener("message", ({ data }) => {
    if (data === "hello") {
      if (source) channel.postMessage(status);
    } else if (typeof data === "string" && events.includes(data)) receive(data);
  });
  function connect() {
    if (abort.signal.aborted) return;
    source = new EventSource(`/api/collaboration/boards/${board}/events`);
    events.forEach((event) => source!.addEventListener(event, () => notify(event)));
    source.onerror = () => notify("stream_error");
    channel?.postMessage("hello");
  }
  function start() {
    if (stopped || document.visibilityState === "hidden") return;
    abort = new AbortController();
    const attempt = abort;
    if (shared) {
      channel.postMessage("hello");
      void navigator.locks
        .request(name, { signal: attempt.signal }, async () => {
          if (attempt.signal.aborted) return;
          connect();
          const owned = source;
          await new Promise<void>((resolve) => {
            release = resolve;
            if (attempt.signal.aborted) resolve();
          });
          owned?.close();
        })
        .catch((error) => {
          if (error.name !== "AbortError") receive("stream_error");
        });
    } else connect();
  }
  function pause() {
    abort.abort();
    source?.close();
    source = undefined;
    release?.();
    release = undefined;
  }
  const visibility = () => {
    if (document.visibilityState === "hidden") pause();
    else start();
  };
  document.addEventListener("visibilitychange", visibility);
  start();
  return () => {
    stopped = true;
    document.removeEventListener("visibilitychange", visibility);
    pause();
    channel?.close();
  };
}
