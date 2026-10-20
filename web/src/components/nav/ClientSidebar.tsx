"use client";

import { CLIENT_NAV } from "@/lib/roles";
import { WorkspaceSidebar } from "./WorkspaceSidebar";

export function ClientSidebar() {
  return <WorkspaceSidebar brand="Northbridge" eyebrow="Client portal" items={CLIENT_NAV} />;
}
