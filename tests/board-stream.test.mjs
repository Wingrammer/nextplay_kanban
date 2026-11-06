import assert from "node:assert/strict";
import test from "node:test";

test("two tabs share one board stream and the follower takes over when its owner closes", async () => {
  const saved = {
    document: globalThis.document,
    window: globalThis.window,
    navigator: Object.getOwnPropertyDescriptor(globalThis, "navigator"),
    channel: globalThis.BroadcastChannel,
    source: globalThis.EventSource,
  };
  const channels = new Set();
  const sources = [];
  let tail = Promise.resolve();
  class Channel {
    constructor() {
      channels.add(this);
    }
    addEventListener(_event, listener) {
      this.listener = listener;
    }
    postMessage(data) {
      for (const peer of channels) if (peer !== this) peer.listener?.({ data });
    }
    close() {
      channels.delete(this);
    }
  }
  class Source {
    handlers = new Map();
    closed = false;
    constructor() {
      sources.push(this);
    }
    addEventListener(event, listener) {
      this.handlers.set(event, listener);
    }
    close() {
      this.closed = true;
    }
  }
  globalThis.window = {};
  globalThis.document = {
    visibilityState: "visible",
    addEventListener() {},
    removeEventListener() {},
  };
  globalThis.BroadcastChannel = Channel;
  globalThis.EventSource = Source;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      locks: {
        request(_name, options, callback) {
          const next = tail.then(() => (options.signal.aborted ? undefined : callback()));
          tail = next.catch(() => {});
          return next;
        },
      },
    },
  });
  let first;
  let second;
  try {
    const { subscribeBoard } = await import("../app/lib/board-stream.ts");
    const received = [];
    first = subscribeBoard("board", "user", () => {});
    second = subscribeBoard("board", "user", (event) => received.push(event));
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(sources.length, 1, "sibling tabs must not exhaust the browser connection pool");
    sources[0].handlers.get("ready")();
    sources[0].handlers.get("board_changed")();
    assert.ok(received.includes("ready"));
    assert.ok(received.includes("board_changed"));
    first();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(sources.length, 2);
    assert.equal(sources[0].closed, true);
  } finally {
    first?.();
    second?.();
    globalThis.window = saved.window;
    globalThis.document = saved.document;
    globalThis.BroadcastChannel = saved.channel;
    globalThis.EventSource = saved.source;
    if (saved.navigator) Object.defineProperty(globalThis, "navigator", saved.navigator);
    else delete globalThis.navigator;
  }
});
