"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ClientTable } from "@/components/ClientTable";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { RequireStaff } from "@/components/RequireStaff";
import { useClients } from "@/hooks/useClients";
import { useStaff } from "@/hooks/useStaff";
import { clientHmrcStatus, matchesQuery } from "@/lib/practice";

function ClientsBody() {
  const clients = useClients();
  const staff = useStaff();
  const params = useSearchParams();
  const query = params.get("q") ?? "";
  const type = params.get("type") ?? "";
  const hmrc = params.get("hmrc") ?? "";
  const risk = params.get("risk") ?? "";
  const rows = (clients.data ?? []).filter((row) => {
    if (type && row.type !== type) {
      return false;
    }
    if (risk && (row.riskLevel ?? "MEDIUM") !== risk) {
      return false;
    }
    if (hmrc && clientHmrcStatus(row) !== hmrc) {
      return false;
    }
    return matchesQuery([row.name, row.nino, row.vatRegistrationNumber, row.utr], query);
  });
  const team = (staff.data ?? []).filter((row) => row.role !== "CLIENT" && row.status !== "SUSPENDED");

  return clients.isLoading ? (
    <LoadingSpinner label="Loading clients…" />
  ) : (
    <ClientTable rows={rows} staff={team} canCreate />
  );
}

export default function ClientsPage() {
  return (
    <RequireStaff>
      <Suspense fallback={<LoadingSpinner label="Loading clients…" />}>
        <ClientsBody />
      </Suspense>
    </RequireStaff>
  );
}
