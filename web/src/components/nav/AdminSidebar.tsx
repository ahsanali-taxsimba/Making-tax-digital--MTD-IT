"use client";

import { useSession } from "@/hooks/useSession";
import { adminNavFor, canonicalRole } from "@/lib/roles";
import { WorkspaceSidebar } from "./WorkspaceSidebar";

export function AdminSidebar() {
  const { user } = useSession();
  return <WorkspaceSidebar brand="Northbridge" eyebrow="Platform console" items={adminNavFor(canonicalRole(user))} tone="ink" />;
}
