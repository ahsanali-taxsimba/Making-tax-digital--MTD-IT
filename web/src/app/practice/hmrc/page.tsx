"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { HMRCConnectionTable } from "@/components/HMRCConnectionTable";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { RequireStaff } from "@/components/RequireStaff";
import { useHMRCStatus } from "@/hooks/useHmrcStatus";
import { matchesQuery } from "@/lib/practice";
import type { HmrcConnectionOverview } from "@/lib/types";

function HmrcBody() {
  const connections = useHMRCStatus();
  const params = useSearchParams();
  const query = params.get("q") ?? "";
  const hmrc = params.get("hmrc") ?? "";
  const rows = ((connections.data as HmrcConnectionOverview[] | undefined) ?? []).filter((row) => {
    if (hmrc === "connected" && !row.connected) {
      return false;
    }
    if (hmrc === "not_connected" && row.connected) {
      return false;
    }
    return matchesQuery([row.clientName, row.environment, row.vatStatus, row.itsaStatus], query);
  });

  return connections.isLoading ? (
    <LoadingSpinner label="Loading HMRC connections…" />
  ) : (
    <HMRCConnectionTable rows={rows} />
  );
}

export default function HmrcConnectionsPage() {
  return (
    <RequireStaff>
      <Suspense fallback={<LoadingSpinner label="Loading HMRC connections…" />}>
        <HmrcBody />
      </Suspense>
    </RequireStaff>
  );
}
