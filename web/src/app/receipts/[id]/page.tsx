"use client";

import { useParams } from "next/navigation";
import { ReceiptDetailWorkspace } from "@/components/ReceiptDetailWorkspace";
import { RequireStaff } from "@/components/RequireStaff";

export default function ReceiptDetailPage() {
  const params = useParams<{ id: string }>();
  return (
    <RequireStaff>
      <ReceiptDetailWorkspace receiptId={params.id} basePath="/receipts" staffNav />
    </RequireStaff>
  );
}
