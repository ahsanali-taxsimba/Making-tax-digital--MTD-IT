"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createTask, listTasks, updateTask } from "@/lib/tasks";
import type { PracticeTaskStatus, PracticeTaskType } from "@/lib/types";

export function useTasks(enabled = true) {
  return useQuery({
    queryKey: ["tasks"],
    queryFn: listTasks,
    enabled,
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      clientId: string;
      type: PracticeTaskType | string;
      title: string;
      dueDate?: string;
      assigneeId?: string;
      status?: PracticeTaskStatus;
    }) => createTask(body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      await queryClient.invalidateQueries({ queryKey: ["firm-dashboard"] });
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id: string;
      status?: PracticeTaskStatus | string;
      assigneeId?: string | null;
      title?: string;
    }) => updateTask(input.id, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      await queryClient.invalidateQueries({ queryKey: ["firm-dashboard"] });
    },
  });
}
