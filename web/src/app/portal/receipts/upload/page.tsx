"use client";

import { ReceiptUploadWorkspace } from "@/components/ReceiptUploadWorkspace";
import { RequireAuth } from "@/components/RequireAuth";

export default function PortalReceiptUploadPage() {
  return (
    <RequireAuth>
      <ReceiptUploadWorkspace basePath="/portal/receipts" />
    </RequireAuth>
  );
}
