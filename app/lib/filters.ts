import type { Task } from "./tasks";

export type TaskFilters = { query: string; priority: string; status: string; assignee: string; label: string };

// Filters are combined, so a search can be narrowed by person, priority and tag.
export function filterTasks(tasks: Task[], filters: TaskFilters, myMemberID?: string) {
  const query = filters.query.trim().toLocaleLowerCase();
  return tasks.filter(task => {
    const assigned = task.assignee_ids || [];
    const matchesPerson = filters.assignee === "all"
      || (filters.assignee === "unassigned" ? !assigned.length
        : filters.assignee === "me" ? !!myMemberID && assigned.includes(myMemberID)
          : assigned.includes(filters.assignee));
    return (filters.status === "all" || task.status === filters.status)
      && (filters.priority === "all" || task.priority === filters.priority)
      && (filters.label === "all" || task.label_ids?.includes(filters.label))
      && matchesPerson
      && `${task.title} ${task.description || ""}`.toLocaleLowerCase().includes(query);
  });
}
