import { apiFetch } from "./api";
import type { PracticeTask, PracticeTaskStatus, PracticeTaskType } from "./types";

export function listTasks() {
  return apiFetch<PracticeTask[]>("/tasks");
}

export function createTask(body: {
  clientId: string;
  type: PracticeTaskType | string;
  title: string;
  dueDate?: string;
  assigneeId?: string;
  status?: PracticeTaskStatus;
}) {
  return apiFetch<PracticeTask>("/tasks", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateTask(
  id: string,
  body: { status?: PracticeTaskStatus | string; assigneeId?: string | null; title?: string; dueDate?: string | null },
) {
  return apiFetch<PracticeTask>(`/tasks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
