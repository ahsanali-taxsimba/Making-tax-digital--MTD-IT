"use client";

import { ExtractionQueue } from "@/components/invoice-extraction/ExtractionQueue";
import { RequireStaff } from "@/components/RequireStaff";

export default function InvoiceExtractionQueuePage() {
  return (
    <RequireStaff>
      <ExtractionQueue />
    </RequireStaff>
  );
}
