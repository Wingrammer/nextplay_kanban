export const columns = [
  { id: "pending", label: "To do", short: "Plan what comes next" },
  { id: "in_progress", label: "In progress", short: "Give your ideas some momentum" },
  { id: "review", label: "Review", short: "Take a second look" },
  { id: "completed", label: "Complete", short: "Make room for a little celebration" },
] as const;
export type Status = typeof columns[number]["id"];
export type Task = { id: string; title: string; description?: string; status: Status; priority?: string; created_at?: string };

export function normalizeStatus(value: string): Status {
  const aliases: Record<string, Status> = { todo: "pending", to_do: "pending", "in progress": "in_progress", done: "completed", complete: "completed" };
  return columns.some(c => c.id === value) ? value as Status : aliases[value] || "pending";
}
