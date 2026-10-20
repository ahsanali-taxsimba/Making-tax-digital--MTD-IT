"use client";

import { Suspense } from "react";
import { RoleRouter } from "./RoleRouter";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-paper" />}>
      <RoleRouter>{children}</RoleRouter>
    </Suspense>
  );
}
