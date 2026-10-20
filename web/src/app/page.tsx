"use client";

import Link from "next/link";
import { useSession } from "@/hooks/useSession";
import { RequireAuth } from "@/components/RequireAuth";

export default function HomePage() {
  const { clientId } = useSession();
  const query = clientId ? `?clientId=${clientId}` : "";

  return (
    <RequireAuth>
      <div className="space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">Making Tax Digital</p>
          <h1 className="mt-1 text-3xl font-semibold text-ink">HMRC connections</h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-muted">
            Accountants connect a client once. The same HMRC grant covers VAT and Income Tax (ITSA). Tokens stay
            encrypted on the server.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Link
            href={`/vat${query}`}
            className="rounded-2xl border border-line bg-white p-6 shadow-sm transition hover:border-teal/40"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">VAT</p>
            <h2 className="mt-2 text-xl font-semibold">VAT connection</h2>
            <p className="mt-2 text-sm text-ink-muted">
              Review token status, connect or disconnect HMRC VAT, and open VAT obligations.
            </p>
          </Link>
          <Link
            href={`/itsa${query}`}
            className="rounded-2xl border border-line bg-white p-6 shadow-sm transition hover:border-teal/40"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">ITSA</p>
            <h2 className="mt-2 text-xl font-semibold">ITSA connection</h2>
            <p className="mt-2 text-sm text-ink-muted">
              Review token status, connect or disconnect HMRC ITSA, and open quarterly obligations.
            </p>
          </Link>
        </div>
      </div>
    </RequireAuth>
  );
}
