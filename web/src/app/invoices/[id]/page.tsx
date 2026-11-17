"use client";

import { useParams, useSearchParams } from "next/navigation";
import { InvoiceDetailWorkspace } from "@/components/invoice-extraction/InvoiceDetailWorkspace";
import { RequireStaff } from "@/components/RequireStaff";
import type { InvoiceDirection } from "@/lib/invoice-extraction";

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const kind = (search.get("kind") === "purchase" ? "purchase" : "sales") as InvoiceDirection;
  return (
    <RequireStaff>
      <InvoiceDetailWorkspace id={params.id} kind={kind} />
    </RequireStaff>
  );
}
