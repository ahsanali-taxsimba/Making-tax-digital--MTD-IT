"use client";

import { ReceiptUploadWorkspace } from "@/components/ReceiptUploadWorkspace";
import { RequireStaff } from "@/components/RequireStaff";

export default function ReceiptUploadPage() {
  return (
    <RequireStaff>
      <ReceiptUploadWorkspace basePath="/receipts" staffNav />
    </RequireStaff>
  );
}
