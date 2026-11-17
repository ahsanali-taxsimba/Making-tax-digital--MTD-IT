"use client";

import { reconciliationProgress } from "@/lib/reconciliation";

export function ReconciliationProgressBar({
  transactionCount,
  unmatchedCount,
}: {
  transactionCount: number;
  unmatchedCount: number;
}) {
  const cleared = Math.max(0, transactionCount - unmatchedCount);
  const percent = reconciliationProgress({ transactionCount, unmatchedCount });
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <p className="font-medium text-ink">
          {cleared} of {transactionCount} lines cleared
        </p>
        <p className="text-ink-muted">{percent}% reconciled</p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-teal transition-all" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
