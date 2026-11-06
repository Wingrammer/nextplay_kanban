import assert from "node:assert/strict";
import { test } from "node:test";
import { dueInfo } from "../app/lib/dates.ts";
import { filterTasks } from "../app/lib/filters.ts";

test("due indicators use local calendar days and exclude completed work", () => {
  const now = new Date(2026, 10, 6, 23, 59);
  const task = (day, status = "pending") => ({ status, due_date: day && `${day}T12:00:00Z` });
  assert.equal(dueInfo(task("2026-11-05"), now).state, "overdue");
  assert.equal(dueInfo(task("2026-11-06"), now).label, "Due today");
  assert.equal(dueInfo(task("2026-11-08"), now).state, "soon");
  assert.equal(dueInfo(task("2026-11-09"), now).state, "scheduled");
  assert.equal(dueInfo(task("2026-11-05", "completed"), now), null);
  assert.equal(dueInfo(task(null), now), null);
});

test("search, tags, priority and multiple assignees intersect correctly", () => {
  const tasks = [
    {
      id: "a",
      title: "Homepage",
      description: "Keyboard access",
      status: "pending",
      priority: "high",
      assignee_ids: ["me", "alex"],
      label_ids: ["design"],
    },
    {
      id: "b",
      title: "Checkout",
      status: "review",
      priority: "low",
      assignee_ids: [],
      label_ids: ["feature"],
    },
  ];
  const base = { query: "", priority: "all", status: "all", assignee: "all", label: "all" };
  assert.deepEqual(
    filterTasks(
      tasks,
      { ...base, query: " KEYBOARD ", label: "design", assignee: "me", priority: "high" },
      "me",
    ).map((t) => t.id),
    ["a"],
  );
  assert.deepEqual(
    filterTasks(tasks, { ...base, assignee: "unassigned" }).map((t) => t.id),
    ["b"],
  );
  assert.deepEqual(filterTasks(tasks, { ...base, assignee: "me" }, "unknown"), []);
  assert.deepEqual(filterTasks(tasks, { ...base, label: "feature", priority: "high" }), []);
});
