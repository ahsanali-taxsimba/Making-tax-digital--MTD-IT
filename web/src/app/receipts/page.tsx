"use client";

import { ReceiptDashboard } from "@/components/ReceiptDashboard";
import { RequireStaff } from "@/components/RequireStaff";

export default function ReceiptsWorkspacePage() {
  return (
    <RequireStaff>
      <ReceiptDashboard basePath="/receipts" staffNav />
    </RequireStaff>
  );
}
