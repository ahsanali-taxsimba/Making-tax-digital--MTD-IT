"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { inviteStaff, listStaff, updateStaff } from "@/lib/staff";
import type { UserRole, UserStatus } from "@/lib/types";

export function useStaff(enabled = true) {
  return useQuery({
    queryKey: ["staff"],
    queryFn: listStaff,
    enabled,
  });
}

export function useInviteStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; email: string; role: UserRole; password?: string }) => inviteStaff(body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["staff"] });
      await queryClient.invalidateQueries({ queryKey: ["firm-dashboard"] });
    },
  });
}

export function useUpdateStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; role?: UserRole; status?: UserStatus; name?: string }) =>
      updateStaff(input.id, { role: input.role, status: input.status, name: input.name }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["staff"] });
      await queryClient.invalidateQueries({ queryKey: ["firm-dashboard"] });
    },
  });
}
