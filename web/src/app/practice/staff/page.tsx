"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { RequireStaff } from "@/components/RequireStaff";
import { StaffTable } from "@/components/StaffTable";
import { useSession } from "@/hooks/useSession";
import { useStaff } from "@/hooks/useStaff";
import { matchesQuery } from "@/lib/practice";

function StaffBody() {
  const staff = useStaff();
  const { user } = useSession();
  const params = useSearchParams();
  const query = params.get("q") ?? "";
  const role = params.get("role") ?? "";
  const status = params.get("status") ?? "";
  const rows = (staff.data ?? []).filter((row) => {
    if (row.role === "CLIENT") {
      return false;
    }
    if (role && row.role !== role) {
      return false;
    }
    if (status && row.status !== status) {
      return false;
    }
    return matchesQuery([row.name, row.email, row.role], query);
  });

  return staff.isLoading ? <LoadingSpinner label="Loading staff…" /> : <StaffTable rows={rows} currentUserId={user?.id} role={user?.role} />;
}

export default function StaffPage() {
  return (
    <RequireStaff>
      <Suspense fallback={<LoadingSpinner label="Loading staff…" />}>
        <StaffBody />
      </Suspense>
    </RequireStaff>
  );
}
