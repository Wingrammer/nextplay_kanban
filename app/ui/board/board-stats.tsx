import { dueInfo } from "@/app/lib/dates";
import type { Task } from "@/app/lib/tasks";

// These counts describe the whole active board, independent of visible filters.
export function BoardStats({
  tasks,
  now,
  loading,
}: {
  tasks: Task[];
  now: Date;
  loading: boolean;
}) {
  const completed = tasks.filter((task) => task.status === "completed").length;
  const overdue = tasks.filter((task) => dueInfo(task, now)?.state === "overdue").length;
  return (
    <dl className="board-stats" aria-label="Board summary">
      {[
        { label: "Total tasks", count: tasks.length, note: "Ideas, plans and next steps" },
        {
          label: "Completed",
          count: completed,
          note: tasks.length
            ? `${Math.round((completed / tasks.length) * 100)}% of the board`
            : "A fresh start",
        },
        {
          label: "Overdue",
          count: overdue,
          note: overdue ? "A little attention needed" : "Nothing overdue",
        },
      ].map((stat) => (
        <div key={stat.label}>
          <dt>{stat.label}</dt>
          <dd>{loading ? "—" : stat.count}</dd>
          <span>{loading ? "Loading your board..." : stat.note}</span>
        </div>
      ))}
    </dl>
  );
}
