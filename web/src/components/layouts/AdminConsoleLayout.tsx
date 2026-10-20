"use client";

import { AdminSidebar } from "../nav/AdminSidebar";

export function AdminConsoleLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-line bg-white/90 px-6 py-4 backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">Platform owner console</p>
          <p className="text-sm text-ink-muted">Aggregated firm counts only. Client records and documents are hidden.</p>
        </header>
        <main className="flex-1 px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
