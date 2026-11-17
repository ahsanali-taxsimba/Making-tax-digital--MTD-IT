"use client";

import { isDemoSession } from "@/lib/session";
import { useSession } from "@/hooks/useSession";

export function DemoBanner() {
  const { ready } = useSession();
  if (!ready || !isDemoSession()) {
    return null;
  }
  return (
    <div className="border-b border-warning/30 bg-warning-soft px-6 py-2 text-sm text-warning">
      Sample workspace — figures are Northbridge demo data, not a live HMRC submission.
    </div>
  );
}
