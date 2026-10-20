"use client";

import Link from "next/link";
import { resourceTypeLabel, type LinkedEntity } from "@/lib/audit";

export function LinkedEntitiesPanel({ entities }: { entities: LinkedEntity[] }) {
  const documents = entities.filter((item) => item.type === "document");
  const banks = entities.filter((item) => item.type === "bank_transaction" || item.type === "journal");
  const filings = entities.filter((item) => item.type === "vat_return" || item.type === "itsa_submission");
  const others = entities.filter((item) => !documents.includes(item) && !banks.includes(item) && !filings.includes(item));

  if (!entities.length) {
    return <p className="text-sm text-ink-muted">No linked documents or HMRC submissions on this entry.</p>;
  }

  return (
    <div className="space-y-4">
      {documents.length ? (
        <Group title="Linked documents">
          <div className="grid grid-cols-2 gap-3">
            {documents.map((item) => (
              <Link
                key={`${item.type}-${item.id}`}
                href={item.href}
                className="rounded-xl border border-line bg-paper p-3 hover:border-teal/40"
              >
                <span className="flex h-16 items-center justify-center rounded-lg bg-white text-xs font-semibold text-teal">
                  PDF
                </span>
                <p className="mt-2 truncate text-sm font-medium text-ink">{item.label}</p>
                <p className="truncate font-mono text-[11px] text-ink-muted">{item.id}</p>
              </Link>
            ))}
          </div>
        </Group>
      ) : null}
      {banks.length ? (
        <Group title="Linked bank transactions">
          {banks.map((item) => (
            <Row key={`${item.type}-${item.id}`} item={item} />
          ))}
        </Group>
      ) : null}
      {filings.length ? (
        <Group title="Linked VAT / ITSA submissions">
          {filings.map((item) => (
            <Row key={`${item.type}-${item.id}`} item={item} />
          ))}
        </Group>
      ) : null}
      {others.length ? (
        <Group title="Other links">
          {others.map((item) => (
            <Row key={`${item.type}-${item.id}`} item={item} />
          ))}
        </Group>
      ) : null}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{title}</h4>
      <div className="mt-2 space-y-2">{children}</div>
    </div>
  );
}

function Row({ item }: { item: LinkedEntity }) {
  return (
    <Link href={item.href} className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2 hover:border-teal/40">
      <span>
        <span className="block text-sm font-medium text-ink">{item.label}</span>
        <span className="block text-xs text-ink-muted">
          {resourceTypeLabel(item.type)}
          {item.detail ? ` · ${item.detail}` : ""}
        </span>
      </span>
      <span className="text-xs font-semibold text-teal">Open</span>
    </Link>
  );
}
