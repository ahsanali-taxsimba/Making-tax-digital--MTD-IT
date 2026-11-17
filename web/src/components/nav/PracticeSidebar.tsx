"use client";

import { useSession } from "@/hooks/useSession";
import { canonicalRole, practiceNavFor } from "@/lib/roles";
import { WorkspaceSidebar } from "./WorkspaceSidebar";

export function PracticeSidebar() {
  const { user } = useSession();
  return (
    <WorkspaceSidebar
      brand="Northbridge"
      eyebrow="Practice workspace"
      items={practiceNavFor(canonicalRole(user) ?? user?.role)}
    />
  );
}
