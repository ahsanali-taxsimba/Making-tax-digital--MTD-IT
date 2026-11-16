"use client";

import { Suspense } from "react";
import { TopBar } from "../TopBar";
import { PracticeSidebar } from "../nav/PracticeSidebar";

export function PracticeDashboardLayout({ children, firmId }: { children: React.ReactNode; firmId?: string | null }) {
  return (
    <div className="flex min-h-screen">
      <PracticeSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Suspense fallback={<div className="h-[73px] border-b border-line bg-white" />}>
          <TopBar />
        </Suspense>
        {firmId ? <p className="sr-only">Firm {firmId}</p> : null}
        <main className="flex-1 px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
