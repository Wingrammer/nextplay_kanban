import assert from "node:assert/strict";
import test from "node:test";

test("confirmation is consumed once across effect remounts and stripped from the URL", async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;
  let calls = 0;
  let replacement;
  globalThis.window = {
    location: { hash: "#refresh_token=temporary-confirmation-token", pathname: "/", search: "" },
    history: {
      replaceState: (_state, _title, path) => {
        replacement = path;
        globalThis.window.location.hash = "";
      },
    },
  };
  globalThis.fetch = async (path, options) => {
    calls++;
    assert.equal(path, "/api/auth/session");
    assert.equal(replacement, "/", "credentials must leave the address before network work");
    assert.deepEqual(JSON.parse(options.body), { refresh_token: "temporary-confirmation-token" });
    return Response.json({ ok: true });
  };
  try {
    const { finishAuthReturn } = await import("../app/lib/auth-return.ts?success");
    await Promise.all([finishAuthReturn(), finishAuthReturn()]);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.window = originalWindow;
  }
});

test("expired confirmation returns an actionable error without creating a new identity", async () => {
  const originalWindow = globalThis.window;
  globalThis.window = {
    location: {
      hash: "#error=access_denied&error_description=Email+link+expired",
      pathname: "/",
      search: "",
    },
    history: { replaceState: () => {} },
  };
  try {
    const { finishAuthReturn } = await import("../app/lib/auth-return.ts?expired");
    await assert.rejects(finishAuthReturn(), /Email link expired/);
  } finally {
    globalThis.window = originalWindow;
  }
});
