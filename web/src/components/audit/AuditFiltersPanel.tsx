"use client";

import { AUDIT_ACTIONS, AUDIT_RESOURCE_TYPES, resourceTypeLabel, type AuditFilters } from "@/lib/audit";
import type { ClientRecord } from "@/lib/types";

export function AuditFiltersPanel({
  value,
  clients,
  onChange,
  onApply,
}: {
  value: AuditFilters;
  clients: ClientRecord[];
  onChange: (next: AuditFilters) => void;
  onApply: () => void;
}) {
  function patch(partial: Partial<AuditFilters>) {
    onChange({ ...value, ...partial });
  }

  return (
    <aside className="space-y-4 rounded-2xl border border-line bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-sm font-semibold text-ink">Filters</h2>
        <p className="mt-1 text-xs text-ink-muted">Only your firm&apos;s clients and records are listed.</p>
      </div>
      <label className="block text-sm">
        <span className="font-medium text-ink">Client</span>
        <select
          className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2"
          value={value.clientId}
          aria-label="Client"
          onChange={(event) => patch({ clientId: event.target.value })}
        >
          <option value="">All clients</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="font-medium text-ink">Resource type</span>
        <select
          className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2"
          value={value.resourceType}
          aria-label="Resource type"
          onChange={(event) => patch({ resourceType: event.target.value })}
        >
          <option value="">All resources</option>
          {AUDIT_RESOURCE_TYPES.map((type) => (
            <option key={type} value={type}>
              {resourceTypeLabel(type)}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="font-medium text-ink">Action</span>
        <select
          className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2"
          value={value.action}
          aria-label="Action"
          onChange={(event) => patch({ action: event.target.value })}
        >
          <option value="">All actions</option>
          {AUDIT_ACTIONS.map((action) => (
            <option key={action.value} value={action.value}>
              {action.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="font-medium text-ink">From</span>
        <input
          type="date"
          className="mt-1 w-full rounded-lg border border-line px-3 py-2"
          value={value.from}
          aria-label="From date"
          onChange={(event) => patch({ from: event.target.value })}
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-ink">To</span>
        <input
          type="date"
          className="mt-1 w-full rounded-lg border border-line px-3 py-2"
          value={value.to}
          aria-label="To date"
          onChange={(event) => patch({ to: event.target.value })}
        />
      </label>
      <button
        type="button"
        className="w-full rounded-xl bg-teal px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-dark"
        onClick={onApply}
      >
        Apply filters
      </button>
    </aside>
  );
}
