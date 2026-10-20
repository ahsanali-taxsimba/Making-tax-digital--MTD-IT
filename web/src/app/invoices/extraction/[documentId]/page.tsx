"use client";

import { useParams } from "next/navigation";
import { InvoiceExtractionWorkspace } from "@/components/invoice-extraction/InvoiceExtractionWorkspace";
import { RequireStaff } from "@/components/RequireStaff";

export default function InvoiceExtractionReviewPage() {
  const params = useParams<{ documentId: string }>();
  return (
    <RequireStaff>
      <InvoiceExtractionWorkspace documentId={params.documentId} />
    </RequireStaff>
  );
}
