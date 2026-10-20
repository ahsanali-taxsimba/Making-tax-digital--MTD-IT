"use client";

import { Suspense } from "react";
import { HmrcCallbackFlow } from "@/components/HmrcCallbackFlow";
import { LoadingSpinner } from "@/components/LoadingSpinner";

export default function VatCallbackPage() {
  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6 text-2xl font-semibold">HMRC callback</h1>
      <div className="rounded-2xl border border-line bg-white p-8 shadow-sm">
        <Suspense fallback={<LoadingSpinner label="Reading HMRC response…" />}>
          <HmrcCallbackFlow regime="vat" />
        </Suspense>
      </div>
    </div>
  );
}
