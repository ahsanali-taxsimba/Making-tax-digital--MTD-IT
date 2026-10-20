"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { validateVatReturn } from "@/lib/vat";
import { useVatObligations } from "@/hooks/useVatObligations";
import { useSession } from "@/hooks/useSession";
import { formatDate } from "@/lib/format";
import { ErrorBanner } from "@/components/ErrorBanner";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { RequireAuth } from "@/components/RequireAuth";
import { SuccessBanner } from "@/components/SuccessBanner";

function PrepareFlow() {
  const params = useSearchParams();
  const session = useSession();
  const clientId = params.get("clientId") || session.clientId;
  const periodKey = params.get("periodKey") ?? undefined;
  const obligations = useVatObligations(clientId);
  const obligation = obligations.data?.find((item) => item.periodKey === periodKey);
  const preview = useQuery({
    queryKey: ["vat-prepare", clientId, periodKey, obligation?.start, obligation?.end],
    queryFn: () =>
      validateVatReturn({
        clientId: clientId!,
        periodKey,
        periodStart: obligation?.start?.slice(0, 10),
        periodEnd: obligation?.end?.slice(0, 10),
        fromLedger: true,
      }),
    enabled: Boolean(clientId && obligation),
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">VAT return</p>
        <h1 className="mt-1 text-3xl font-semibold">Prepare VAT return</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Boxes are rolled from the ledger for {periodKey ?? "this period"}. Nothing is sent to HMRC from this screen.
        </p>
      </div>

      {obligation ? (
        <section className="rounded-2xl border border-line bg-white p-6 shadow-sm">
          <dl className="grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs uppercase text-ink-muted">Period</dt>
              <dd className="mt-1 text-sm font-medium">
                {formatDate(obligation.start)} – {formatDate(obligation.end)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-ink-muted">Due</dt>
              <dd className="mt-1 text-sm font-medium">{formatDate(obligation.due)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-ink-muted">Status</dt>
              <dd className="mt-1 text-sm font-medium capitalize">{obligation.status.toLowerCase()}</dd>
            </div>
          </dl>
        </section>
      ) : obligations.isLoading ? (
        <LoadingSpinner label="Loading the obligation…" />
      ) : (
        <ErrorBanner title="Period not found" message="Fetch VAT obligations first, then prepare this return." />
      )}

      {preview.isLoading ? <LoadingSpinner label="Validating boxes 1–9 from the ledger…" /> : null}
      {preview.data?.validation.valid ? (
        <SuccessBanner title="Ready to submit" message="The ledger totals pass Notice 700/12 checks." />
      ) : null}
      {preview.data && !preview.data.validation.valid ? (
        <ErrorBanner
          title="Validation issues"
          message={preview.data.validation.errors.join(" ") || "This return is not ready to send."}
        />
      ) : null}

      {preview.data?.vatReturn ? (
        <section className="rounded-2xl border border-line bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Boxes 1–9</h2>
          <dl className="mt-4 grid gap-3 sm:grid-cols-3">
            {Object.entries(preview.data.vatReturn).map(([key, value]) => (
              <div key={key}>
                <dt className="text-xs uppercase text-ink-muted">{key}</dt>
                <dd className="mt-1 text-sm font-medium">{Number(value).toLocaleString("en-GB")}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <Link href="/vat/obligations" className="inline-flex text-sm font-semibold text-teal hover:underline">
        Back to obligations
      </Link>
    </div>
  );
}

export default function PrepareVatReturnPage() {
  return (
    <RequireAuth>
      <Suspense fallback={<LoadingSpinner label="Preparing the VAT return…" />}>
        <PrepareFlow />
      </Suspense>
    </RequireAuth>
  );
}
