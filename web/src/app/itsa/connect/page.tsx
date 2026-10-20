"use client";

import { Suspense } from "react";
import { HmrcConnectFlow } from "@/components/HmrcConnectFlow";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { RequireAuth } from "@/components/RequireAuth";

export default function ItsaConnectPage() {
  return (
    <RequireAuth>
      <h1 className="mb-6 text-2xl font-semibold">Connect to HMRC ITSA</h1>
      <Suspense fallback={<LoadingSpinner label="Preparing HMRC authorisation…" />}>
        <HmrcConnectFlow regime="itsa" />
      </Suspense>
    </RequireAuth>
  );
}
