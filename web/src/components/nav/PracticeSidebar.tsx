"use client";

import { PRACTICE_NAV } from "@/lib/roles";
import { WorkspaceSidebar } from "./WorkspaceSidebar";

export function PracticeSidebar() {
  return <WorkspaceSidebar brand="Northbridge" eyebrow="Practice workspace" items={PRACTICE_NAV} />;
}
