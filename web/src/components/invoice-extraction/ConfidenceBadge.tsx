"use client";

import { confidenceTone } from "@/lib/invoice-extraction";

export function ConfidenceBadge({ value, compact = false }: { value?: number | null; compact?: boolean }) {
  const tone = confidenceTone(value);
  const percent = Math.round(Number(value ?? 0) * 100);
  const classes =
    tone === "high"
      ? "bg-success-soft text-success"
      : tone === "medium"
        ? "bg-paper text-ink"
        : "bg-warning-soft text-warning";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${classes}`}>
      {compact ? `${percent}%` : `${percent}% ${tone} confidence`}
    </span>
  );
}
