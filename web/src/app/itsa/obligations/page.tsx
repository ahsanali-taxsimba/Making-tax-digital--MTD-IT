"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ApiError } from "@/lib/api";
import { hmrcUserMessage } from "@/lib/errors";
import { getSelectedClientId } from "@/lib/session";
import { useItsaObligations } from "@/hooks/useItsaObligations";
import { useSession } from "@/hooks/useSession";
import { ErrorBanner } from "@/components/ErrorBanner";
import { ItsaObligationsList } from "@/components/ItsaObligationsList";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { RequireAuth } from "@/components/RequireAuth";

function ObligationsFlow() {
  const params = useSearchParams();
  const session = useSession();
  const clientId = params.get("clientId") || session.clientId || getSelectedClientId();
  const query = useItsaObligations(clientId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">ITSA</p>
          <h1 className="mt-1 text-3xl font-semibold">ITSA obligations</h1>
          <p className="mt-2 text-sm text-ink-muted">
            Open quarterly updates are ready to submit. Fulfilled periods have already been sent to HMRC.
          </p>
        </div>
        <Link href="/itsa" className="text-sm font-semibold text-teal hover:underline">
          Back to connection
        </Link>
      </div>

      {query.isError ? (
        <ErrorBanner
          title="Unable to load obligations"
          message={hmrcUserMessage(
            query.error instanceof ApiError ? query.error.errorCode : undefined,
            query.error instanceof Error ? query.error.message : "HMRC could not return ITSA obligations.",
            "itsa",
          )}
        />
      ) : (
        <ItsaObligationsList obligations={query.data} isLoading={query.isLoading} clientId={clientId} />
      )}
    </div>
  );
}

export default function ItsaObligationsPage() {
  return (
    <RequireAuth>
      <Suspense fallback={<LoadingSpinner label="Loading ITSA obligations…" />}>
        <ObligationsFlow />
      </Suspense>
    </RequireAuth>
  );
}
