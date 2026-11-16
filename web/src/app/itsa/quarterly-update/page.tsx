"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ApiError } from "@/lib/api";
import { hmrcUserMessage } from "@/lib/errors";
import { businessTypeLabel, categoryLabel, formatDate, formatMoney, obligationStatus } from "@/lib/format";
import { useReceiptEvidence } from "@/hooks/useReceipts";
import { useItsaObligations, useItsaValidation, useSubmitItsaQuarterly } from "@/hooks/useItsaObligations";
import { useSession } from "@/hooks/useSession";
import { ErrorBanner } from "@/components/ErrorBanner";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { RequireAuth } from "@/components/RequireAuth";
import { SuccessBanner } from "@/components/SuccessBanner";

function ReceiptProofNote({ clientId }: { clientId?: string | null }) {
  const evidence = useReceiptEvidence(clientId);
  if (!evidence.data) {
    return null;
  }
  return (
    <p className="rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink-muted">
      Receipt attached on {evidence.data.itsa.allowableExpensesWithReceipt} of {evidence.data.itsa.allowableExpenses}{" "}
      allowable expense journals · {evidence.data.receiptsAttached} receipts on file.
    </p>
  );
}

function TotalsTable({ title, values }: { title: string; values?: Record<string, number> }) {
  const entries = Object.entries(values ?? {});
  return (
    <section className="rounded-2xl border border-line bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold">{title}</h2>
      {entries.length ? (
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          {entries.map(([key, value]) => (
            <div key={key}>
              <dt className="text-xs uppercase text-ink-muted">{categoryLabel(key)}</dt>
              <dd className="mt-1 text-sm font-medium">{formatMoney(value)}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-3 text-sm text-ink-muted">No {title.toLowerCase()} rolled from the ledger for this period.</p>
      )}
    </section>
  );
}

function QuarterlyFlow() {
  const params = useSearchParams();
  const session = useSession();
  const clientId = params.get("clientId") || session.clientId;
  const obligationId = params.get("obligationId") ?? undefined;
  const businessIdParam = params.get("businessId") ?? undefined;
  const taxYearParam = params.get("taxYear") ?? undefined;
  const periodIdParam = params.get("periodId") ?? undefined;
  const obligations = useItsaObligations(clientId);
  const obligation = obligations.data?.find((item) => item.id === obligationId) ?? obligations.data?.find((item) => {
    return item.periodId === periodIdParam && item.taxYear === taxYearParam;
  });
  const businessId = businessIdParam || obligation?.businessId || obligation?.business?.id || undefined;
  const taxYear = taxYearParam || obligation?.taxYear;
  const periodId = periodIdParam || obligation?.periodId || undefined;
  const periodStart = obligation?.start?.slice(0, 10);
  const periodEnd = obligation?.end?.slice(0, 10);
  const preview = useItsaValidation({
    clientId,
    businessId,
    taxYear,
    periodId,
    periodStart,
    periodEnd,
    enabled: Boolean(clientId && businessId && periodStart && periodEnd),
  });
  const submit = useSubmitItsaQuarterly();
  const canSubmit = session.canManage && Boolean(clientId && businessId && taxYear && periodId && periodStart && periodEnd);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">ITSA quarterly update</p>
        <h1 className="mt-1 text-3xl font-semibold">Submit quarterly update</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Categories are rolled from the ledger for {taxYear ?? "this tax year"}. Capital and disallowable items stay
          off the quarterly update.
        </p>
      </div>

      {obligation ? (
        <section className="rounded-2xl border border-line bg-white p-6 shadow-sm">
          <dl className="grid gap-4 sm:grid-cols-4">
            <div>
              <dt className="text-xs uppercase text-ink-muted">Business type</dt>
              <dd className="mt-1 text-sm font-medium">
                {businessTypeLabel(obligation.business?.type)}
                {obligation.business?.tradingName ? (
                  <span className="block text-ink-muted">{obligation.business.tradingName}</span>
                ) : null}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-ink-muted">Period</dt>
              <dd className="mt-1 text-sm font-medium">
                {obligation.periodId ?? obligation.taxYear}
                <span className="block text-ink-muted">
                  {formatDate(obligation.start)} – {formatDate(obligation.end)}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-ink-muted">Due</dt>
              <dd className="mt-1 text-sm font-medium">{formatDate(obligation.due)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-ink-muted">Status</dt>
              <dd className="mt-1 text-sm font-medium capitalize">{obligationStatus(obligation.status)}</dd>
            </div>
          </dl>
        </section>
      ) : obligations.isLoading ? (
        <LoadingSpinner label="Loading the obligation…" />
      ) : (
        <ErrorBanner title="Period not found" message="Fetch ITSA obligations first, then prepare this quarterly update." />
      )}

      {preview.isLoading ? <LoadingSpinner label="Validating Income Tax categories from the ledger…" /> : null}
      {preview.isError ? (
        <ErrorBanner
          title="Unable to validate this update"
          message={hmrcUserMessage(
            preview.error instanceof ApiError ? preview.error.errorCode : undefined,
            preview.error instanceof Error ? preview.error.message : "HMRC could not validate this quarterly update.",
            "itsa",
          )}
        />
      ) : null}
      {preview.data?.validation.valid ? (
        <SuccessBanner title="Ready to submit" message="The ledger totals pass HMRC quarterly category checks." />
      ) : null}
      {preview.data && !preview.data.validation.valid ? (
        <ErrorBanner
          title="Validation issues"
          message={preview.data.validation.errors.join(" ") || "This quarterly update is not ready to send."}
        />
      ) : null}

      {preview.data ? (
        <>
          <TotalsTable title="Income" values={preview.data.incomes} />
          <TotalsTable title="Allowable expenses" values={preview.data.expenses} />
          <ReceiptProofNote clientId={clientId} />
          {preview.data.excluded?.length ? (
            <section className="rounded-2xl border border-line bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold">Excluded from this update</h2>
              <ul className="mt-3 space-y-2 text-sm text-ink-muted">
                {preview.data.excluded.map((item, index) => (
                  <li key={`${item.category}-${index}`}>
                    {categoryLabel(item.category)} {formatMoney(item.amount)}
                    {item.reason ? ` · ${categoryLabel(item.reason)}` : ""}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : null}

      {submit.isSuccess ? (
        <SuccessBanner title="Quarterly update submitted" message="HMRC has accepted this period. Tokens were never shown in the browser." />
      ) : null}
      {submit.isError ? (
        <ErrorBanner
          title="Unable to submit"
          message={hmrcUserMessage(
            submit.error instanceof ApiError ? submit.error.errorCode : undefined,
            submit.error instanceof Error ? submit.error.message : "HMRC could not accept this quarterly update.",
            "itsa",
          )}
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        {session.canManage ? (
          <button
            type="button"
            disabled={!canSubmit || submit.isPending || preview.data?.validation.valid === false}
            onClick={() =>
              submit.mutate({
                clientId: clientId!,
                businessId: businessId!,
                taxYear: taxYear!,
                periodId: periodId!,
                periodStart: periodStart!,
                periodEnd: periodEnd!,
                fromLedger: true,
              })
            }
            className="inline-flex rounded-xl bg-teal px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submit.isPending ? "Submitting…" : "Submit Quarterly Update"}
          </button>
        ) : (
          <p className="text-sm text-ink-muted">Ask your accountant if this quarterly update needs to be sent to HMRC.</p>
        )}
        <Link href="/itsa/obligations" className="inline-flex text-sm font-semibold text-teal hover:underline">
          Back to obligations
        </Link>
      </div>
    </div>
  );
}

export default function ItsaQuarterlyUpdatePage() {
  return (
    <RequireAuth>
      <Suspense fallback={<LoadingSpinner label="Preparing the quarterly update…" />}>
        <QuarterlyFlow />
      </Suspense>
    </RequireAuth>
  );
}
