"use client";

import { ReceiptDashboard } from "@/components/ReceiptDashboard";
import { RequireAuth } from "@/components/RequireAuth";

export default function PortalReceiptsPage() {
  return (
    <RequireAuth>
      <ReceiptDashboard basePath="/portal/receipts" />
    </RequireAuth>
  );
}
