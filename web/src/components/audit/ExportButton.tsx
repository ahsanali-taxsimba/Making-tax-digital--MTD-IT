"use client";

import { auditExportCsv, downloadText, exportPeriod, type AuditExport, type AuditFilters } from "@/lib/audit";

export function ExportButton({
  filters,
  exporting,
  onExport,
}: {
  filters: AuditFilters;
  exporting?: boolean;
  onExport: () => Promise<AuditExport>;
}) {
  async function run(format: "json" | "csv") {
    const trail = await onExport();
    const stamp = new Date().toISOString().slice(0, 10);
    const period = trail.period?.start?.slice(0, 10) ?? exportPeriod(filters);
    if (format === "csv") {
      downloadText(`hmrc-audit-${period}-${stamp}.csv`, auditExportCsv(trail.entries), "text/csv");
      return;
    }
    downloadText(`hmrc-audit-${period}-${stamp}.json`, JSON.stringify(trail, null, 2), "application/json");
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className="rounded-xl bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-dark disabled:opacity-60"
        disabled={exporting}
        onClick={() => void run("json")}
      >
        {exporting ? "Exporting…" : "Export audit trail for HMRC"}
      </button>
      <button
        type="button"
        className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold text-ink hover:border-teal/40 disabled:opacity-60"
        disabled={exporting}
        onClick={() => void run("csv")}
      >
        Download CSV
      </button>
    </div>
  );
}
