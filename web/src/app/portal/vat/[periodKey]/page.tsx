"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { formatDate, formatMoney, obligationStatus } from "@/lib/format";
import { useClient } from "@/hooks/useClient";
import { useClientObligations, useConfirmPortal, useVatDraft, useVatReturns } from "@/hooks/useClientObligations";
import { useSession } from "@/hooks/useSession";
import { ErrorBanner } from "@/components/ErrorBanner";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { RequireAuth } from "@/components/RequireAuth";
import { SuccessBanner } from "@/components/SuccessBanner";

function downloadSummary(periodKey: string, boxes: Record<string, number | undefined>) {
  const lines = [`VAT return ${periodKey}`, "", ...Object.entries(boxes).map(([key, value]) => `${key}: ${value ?? 0}`)];
  const blob = new Blob([lines.join("\n")], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `vat-${periodKey}-summary.txt`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function PortalVatDetailPage() {
  const params = useParams<{ periodKey: string }>();
  const periodKey = decodeURIComponent(params.periodKey);
  const { clientId, user, canManage, ready } = useSession();
  const client = useClient();
  const resolvedId = client.data?.id ?? clientId ?? user?.clientId;
  const { vat } = useClientObligations(resolvedId);
  const returns = useVatReturns(resolvedId);
  const obligation = vat.data?.find((item) => item.periodKey === periodKey);
  const submitted = returns.data?.find((item) => item.periodKey === periodKey);
  const draft = useVatDraft(resolvedId, periodKey, obligation?.start?.slice(0, 10), obligation?.end?.slice(0, 10));
  const confirm = useConfirmPortal();
  const boxes = submitted ?? draft.data?.vatReturn;

  return (
    <RequireAuth>
      <div className="space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">VAT return</p>
          <h1 className="mt-1 text-3xl font-semibold">{periodKey}</h1>
          <p className="mt-2 text-sm text-ink-muted">
            {obligation ? `${formatDate(obligation.start)} – ${formatDate(obligation.end)} · due ${formatDate(obligation.due)}` : "Period detail"}
          </p>
        </div>

        {obligation ? (
          <p className="text-sm">
            Status: <span className="font-semibold capitalize">{obligationStatus(obligation.status)}</span>
          </p>
        ) : vat.isLoading ? (
          <LoadingSpinner label="Loading the period…" />
        ) : (
          <ErrorBanner title="Period not found" message="This VAT period is not on your account yet." />
        )}

        {draft.isLoading ? <LoadingSpinner label="Reviewing the draft VAT return…" /> : null}
        {draft.data?.validation.valid ? <SuccessBanner title="Draft ready" message="Boxes 1–9 pass the Notice 700/12 checks." /> : null}
        {draft.data && !draft.data.validation.valid ? (
          <ErrorBanner title="Draft needs attention" message={draft.data.validation.errors.join(" ") || "Ask your accountant before approving."} />
        ) : null}

        {boxes ? (
          <section className="rounded-2xl border border-line bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Boxes 1–9</h2>
            <dl className="mt-4 grid gap-3 sm:grid-cols-3">
              {([1, 2, 3, 4, 5, 6, 7, 8, 9] as const).map((box) => (
                <div key={box}>
                  <dt className="text-xs uppercase text-ink-muted">Box {box}</dt>
                  <dd className="mt-1 text-sm font-medium">{formatMoney(Number(boxes[`box${box}` as keyof typeof boxes]))}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}

        {confirm.isSuccess ? <SuccessBanner title="Approved" message="Your accountant can now send this return to HMRC." /> : null}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() =>
              downloadSummary(periodKey, {
                box1: Number(boxes?.box1),
                box2: Number(boxes?.box2),
                box3: Number(boxes?.box3),
                box4: Number(boxes?.box4),
                box5: Number(boxes?.box5),
                box6: Number(boxes?.box6),
                box7: Number(boxes?.box7),
                box8: Number(boxes?.box8),
                box9: Number(boxes?.box9),
              })
            }
            className="rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-semibold hover:bg-paper"
          >
            Download PDF summary
          </button>
          <button
            type="button"
            disabled={draft.isFetching}
            onClick={() => void draft.refetch()}
            className="rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-semibold hover:bg-paper"
          >
            Review draft VAT return
          </button>
          {ready && !canManage ? (
            <button
              type="button"
              onClick={() => confirm.mutate({ kind: "vat", note: `I approve VAT return ${periodKey}.` })}
              className="rounded-xl bg-teal px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-dark"
            >
              Approve this return
            </button>
          ) : null}
          <Link href="/portal/vat" className="inline-flex items-center text-sm font-semibold text-teal hover:underline">
            Back to VAT periods
          </Link>
        </div>
      </div>
    </RequireAuth>
  );
}
