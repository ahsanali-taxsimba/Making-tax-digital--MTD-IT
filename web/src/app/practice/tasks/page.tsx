"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { RequireStaff } from "@/components/RequireStaff";
import { TaskBoard } from "@/components/TaskBoard";
import { useClients } from "@/hooks/useClients";
import { useStaff } from "@/hooks/useStaff";
import { useTasks } from "@/hooks/useTasks";
import { matchesQuery, taskTypeLabel } from "@/lib/practice";

function TasksBody() {
  const tasks = useTasks();
  const clients = useClients();
  const staff = useStaff();
  const params = useSearchParams();
  const query = params.get("q") ?? "";
  const type = params.get("type") ?? "";
  const rows = (tasks.data ?? []).filter((row) => {
    if (type && !String(row.type).includes(type)) {
      return false;
    }
    return matchesQuery([row.title, row.client?.name, taskTypeLabel(row.type), row.assignee?.name], query);
  });
  const team = (staff.data ?? []).filter((row) => row.role !== "CLIENT" && row.status !== "SUSPENDED");

  return tasks.isLoading ? (
    <LoadingSpinner label="Loading the task board…" />
  ) : (
    <TaskBoard tasks={rows} clients={clients.data ?? []} staff={team} />
  );
}

export default function TasksPage() {
  return (
    <RequireStaff>
      <Suspense fallback={<LoadingSpinner label="Loading the task board…" />}>
        <TasksBody />
      </Suspense>
    </RequireStaff>
  );
}
