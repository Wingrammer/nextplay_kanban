import type { Task } from "./tasks";

// A due date is a calendar day, not a deadline at midnight UTC. Compare local
// calendar dates so a task does not become overdue early in western time zones.
function calendarDay(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function dueInfo(task: Pick<Task, "status" | "due_date">, now = new Date()) {
  if (!task.due_date || task.status === "completed") return null;
  const day = task.due_date.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day < "1900-01-01") return null;
  const today = calendarDay(now);
  const soon = calendarDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2));
  const [year, month, date] = day.split("-").map(Number);
  const label = new Date(year, month - 1, date).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  if (day < today) return { state: "overdue", label: `Overdue · ${label}` };
  if (day === today) return { state: "soon", label: "Due today" };
  if (day <= soon) return { state: "soon", label: `Due soon · ${label}` };
  return { state: "scheduled", label: `Due ${label}` };
}
