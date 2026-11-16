"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ApiError } from "@/lib/api";
import { hmrcUserMessage } from "@/lib/errors";
import { getSelectedClientId } from "@/lib/session";
import { useVatObligations } from "@/hooks/useVatObligations";
import { useSession } from "@/hooks/useSession";
import { ErrorBanner } from "@/components/ErrorBanner";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { ObligationsList } from "@/components/ObligationsList";
import { RequireAuth } from "@/components/RequireAuth";

function ObligationsFlow() {
  const params = useSearchParams();
  const session = useSession();
  const clientId = params.get("clientId") || session.clientId || getSelectedClientId();
  const query = useVatObligations(clientId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">VAT</p>
          <h1 className="mt-1 text-3xl font-semibold">VAT obligations</h1>
          <p className="mt-2 text-sm text-ink-muted">Open periods are ready to prepare. Fulfilled periods have already been sent to HMRC.</p>
        </div>
        <Link href="/vat" className="text-sm font-semibold text-teal hover:underline">
          Back to connection
        </Link>
      </div>

      {query.isError ? (
        <ErrorBanner
          title="Unable to load obligations"
          message={hmrcUserMessage(
            query.error instanceof ApiError ? query.error.errorCode : undefined,
            query.error instanceof Error ? query.error.message : "HMRC could not return VAT obligations.",
          )}
        />
      ) : (
        <ObligationsList obligations={query.data} isLoading={query.isLoading} clientId={clientId} />
      )}
    </div>
  );
}

export default function VatObligationsPage() {
  return (
    <RequireAuth>
      <Suspense fallback={<LoadingSpinner label="Loading VAT obligations…" />}>
        <ObligationsFlow />
      </Suspense>
    </RequireAuth>
  );
}
