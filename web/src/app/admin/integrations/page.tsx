"use client";

import { WorkspaceGate } from "@/components/WorkspaceGate";

const INTEGRATIONS = [
  {
    name: "HMRC Making Tax Digital",
    detail: "VAT obligations, VAT returns, ITSA quarterly updates, EOPS, and final declarations.",
    status: "Connected at firm level",
  },
  {
    name: "Yapily Open Banking",
    detail: "Bank feed consent and transaction sync. Feeds stay inside the owning firm.",
    status: "Configured",
  },
  {
    name: "Manual CSV statements",
    detail: "Accountants upload statements for clients in their own tenant only.",
    status: "Available",
  },
];

export default function AdminIntegrationsPage() {
  return (
    <WorkspaceGate allow="platform">
      <div className="space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">Platform</p>
          <h2 className="mt-1 text-2xl font-semibold text-ink">Integrations</h2>
          <p className="mt-2 text-sm text-ink-muted">
            Platform status only. Tokens, consents, and client bank accounts are not shown here.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {INTEGRATIONS.map((item) => (
            <section key={item.name} className="rounded-2xl border border-line bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">{item.status}</p>
              <h3 className="mt-2 text-lg font-semibold text-ink">{item.name}</h3>
              <p className="mt-2 text-sm text-ink-muted">{item.detail}</p>
            </section>
          ))}
        </div>
      </div>
    </WorkspaceGate>
  );
}
