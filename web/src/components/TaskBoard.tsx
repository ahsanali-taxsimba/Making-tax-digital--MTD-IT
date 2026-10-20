"use client";

import { FormEvent, useState } from "react";
import { useCreateTask, useUpdateTask } from "@/hooks/useTasks";
import { formatDate } from "@/lib/format";
import {
  CREATEABLE_TASK_STATUSES,
  PRACTICE_TASK_TYPES,
  TASK_BOARD_COLUMNS,
  taskColumn,
  taskTypeLabel,
} from "@/lib/practice";
import type { ClientRecord, PracticeTask, PracticeTaskStatus, PracticeTaskType, StaffMember } from "@/lib/types";
import { ErrorBanner } from "./ErrorBanner";

export function TaskBoard({
  tasks,
  clients,
  staff,
}: {
  tasks: PracticeTask[];
  clients: ClientRecord[];
  staff: StaffMember[];
}) {
  const create = useCreateTask();
  const update = useUpdateTask();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [type, setType] = useState<PracticeTaskType>("VAT_RETURN");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueDate, setDueDate] = useState("");

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    await create.mutateAsync({
      title,
      clientId: clientId || clients[0]?.id,
      type,
      assigneeId: assigneeId || undefined,
      dueDate: dueDate || undefined,
      status: "OPEN",
    });
    setTitle("");
    setOpen(false);
  }

  function onDrop(status: PracticeTaskStatus, taskId?: string) {
    if (!taskId) {
      return;
    }
    update.mutate({ id: taskId, status });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-muted">{tasks.length} tasks</p>
        <button
          type="button"
          className="rounded-xl bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-dark"
          onClick={() => setOpen((value) => !value)}
        >
          Add task
        </button>
      </div>
      {open ? (
        <form onSubmit={onCreate} className="grid gap-3 rounded-2xl border border-line bg-white p-4 md:grid-cols-5">
          {create.error ? <div className="md:col-span-5"><ErrorBanner title="Could not create task" message={create.error.message} /></div> : null}
          <input className="rounded-lg border border-line px-3 py-2 text-sm md:col-span-2" placeholder="Task title" value={title} onChange={(event) => setTitle(event.target.value)} required />
          <select className="rounded-lg border border-line px-3 py-2 text-sm" value={clientId} onChange={(event) => setClientId(event.target.value)} required>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
          <select className="rounded-lg border border-line px-3 py-2 text-sm" value={type} onChange={(event) => setType(event.target.value as PracticeTaskType)}>
            {PRACTICE_TASK_TYPES.map((item) => (
              <option key={item} value={item}>
                {taskTypeLabel(item)}
              </option>
            ))}
          </select>
          <select className="rounded-lg border border-line px-3 py-2 text-sm" value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}>
            <option value="">Unassigned</option>
            {staff.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
          <input className="rounded-lg border border-line px-3 py-2 text-sm" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          <button type="submit" disabled={create.isPending} className="rounded-xl bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-dark disabled:opacity-60">
            {create.isPending ? "Saving…" : "Create task"}
          </button>
        </form>
      ) : null}
      <div className="grid gap-4 xl:grid-cols-4">
        {TASK_BOARD_COLUMNS.map((column) => {
          const cards = tasks.filter((task) => taskColumn(task.status) === column.id);
          return (
            <section
              key={column.id}
              className="rounded-2xl border border-line bg-paper/60 p-3"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => onDrop(column.id, event.dataTransfer.getData("text/task-id"))}
            >
              <header className="mb-3 flex items-center justify-between px-1">
                <h2 className="text-sm font-semibold text-ink">{column.title}</h2>
                <span className="text-xs text-ink-muted">{cards.length}</span>
              </header>
              <div className="space-y-3">
                {cards.map((task) => (
                  <article
                    key={task.id}
                    draggable
                    onDragStart={(event) => event.dataTransfer.setData("text/task-id", task.id)}
                    className="cursor-grab rounded-xl border border-line bg-white p-3 shadow-sm"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">
                      {taskTypeLabel(task.type)}
                    </p>
                    <h3 className="mt-1 text-sm font-semibold text-ink">{task.title}</h3>
                    <p className="mt-1 text-xs text-ink-muted">{task.client?.name ?? "Unassigned client"}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <select
                        className="rounded-lg border border-line px-2 py-1 text-xs"
                        value={task.assigneeId ?? ""}
                        onChange={(event) => update.mutate({ id: task.id, assigneeId: event.target.value || null })}
                      >
                        <option value="">Unassigned</option>
                        {staff.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.name}
                          </option>
                        ))}
                      </select>
                      <select
                        className="rounded-lg border border-line px-2 py-1 text-xs"
                        value={taskColumn(task.status) === "HIDDEN" ? "OPEN" : task.status}
                        onChange={(event) => update.mutate({ id: task.id, status: event.target.value })}
                      >
                        {CREATEABLE_TASK_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {TASK_BOARD_COLUMNS.find((item) => item.id === status)?.title}
                          </option>
                        ))}
                      </select>
                    </div>
                    <p className="mt-2 text-xs text-ink-muted">Due {formatDate(task.dueDate)}</p>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
