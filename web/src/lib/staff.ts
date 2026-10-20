import { apiFetch } from "./api";
import type { StaffMember, UserRole, UserStatus } from "./types";

export function listStaff() {
  return apiFetch<StaffMember[]>("/users");
}

export function inviteStaff(body: { name: string; email: string; role: UserRole; password?: string }) {
  return apiFetch<StaffMember>("/users", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateStaff(id: string, body: { role?: UserRole; status?: UserStatus; name?: string }) {
  return apiFetch<StaffMember>(`/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
