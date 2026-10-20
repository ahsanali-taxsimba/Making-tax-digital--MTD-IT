"use client";

import { useSession } from "./useSession";
import { canonicalRole, homePath, principalOf } from "@/lib/roles";

export function useRole() {
  const { user, ready } = useSession();
  const role = canonicalRole(user);
  return {
    user,
    ready,
    role,
    principal: principalOf(user),
    homePath: homePath(user),
    isPlatform: role?.startsWith("admin_") ?? false,
    isPractice: role === "firm_admin" || role === "firm_accountant" || role === "firm_staff",
    isClient: role === "firm_client",
  };
}
