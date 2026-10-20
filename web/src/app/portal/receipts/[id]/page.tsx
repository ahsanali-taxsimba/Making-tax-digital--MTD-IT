"use client";

import { useParams } from "next/navigation";
import { ReceiptDetailWorkspace } from "@/components/ReceiptDetailWorkspace";
import { RequireAuth } from "@/components/RequireAuth";

export default function PortalReceiptDetailPage() {
  const params = useParams<{ id: string }>();
  return (
    <RequireAuth>
      <ReceiptDetailWorkspace receiptId={params.id} basePath="/portal/receipts" />
    </RequireAuth>
  );
}
