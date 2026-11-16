"use client";

import { ClientSidebar } from "../nav/ClientSidebar";

export function ClientPortalLayout({ children, clientId }: { children: React.ReactNode; clientId?: string | null }) {
  return (
    <div className="flex min-h-screen">
      <ClientSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-line bg-white/90 px-6 py-4 backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">Your tax portal</p>
          <p className="text-sm text-ink-muted">You can only see your own records.</p>
        </header>
        {clientId ? <p className="sr-only">Client {clientId}</p> : null}
        <main className="flex-1 px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
