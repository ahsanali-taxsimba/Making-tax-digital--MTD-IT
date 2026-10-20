"use client";

import { ADMIN_NAV } from "@/lib/roles";
import { WorkspaceSidebar } from "./WorkspaceSidebar";

export function AdminSidebar() {
  return <WorkspaceSidebar brand="Northbridge" eyebrow="Platform console" items={ADMIN_NAV} tone="ink" />;
}
