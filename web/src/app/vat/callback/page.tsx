"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { ApiError } from "@/lib/api";
import { hmrcUserMessage } from "@/lib/errors";
import { useHmrcCallback } from "@/hooks/useHmrcCallback";
import { ErrorBanner } from "@/components/ErrorBanner";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { SuccessBanner } from "@/components/SuccessBanner";

function CallbackFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const code = params.get("code") ?? undefined;
  const state = params.get("state") ?? undefined;
  const environment = params.get("environment") ?? undefined;
  const error = params.get("error") ?? undefined;
  const errorDescription = params.get("error_description") ?? undefined;
  const callback = useHmrcCallback({
    code,
    state,
    environment,
    error,
    error_description: errorDescription,
  });

  useEffect(() => {
    if (callback.isSuccess) {
      const timer = window.setTimeout(() => router.replace("/vat"), 1400);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [callback.isSuccess, router]);

  if (!code && !state && !error) {
    return <ErrorBanner title="Missing callback" message="HMRC did not return an authorisation code or state." />;
  }

  if (callback.isPending) {
    return <LoadingSpinner label="Completing HMRC authorisation…" />;
  }

  if (callback.isError) {
    return (
      <ErrorBanner
        title="Authorisation failed"
        message={hmrcUserMessage(
          callback.error instanceof ApiError ? callback.error.errorCode : undefined,
          "HMRC returned an error during authorisation.",
        )}
      />
    );
  }

  return (
    <SuccessBanner
      title="HMRC VAT connected"
      message="The access token is stored encrypted on the server. Taking you back to the VAT dashboard."
    />
  );
}

export default function VatCallbackPage() {
  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6 text-2xl font-semibold">HMRC callback</h1>
      <div className="rounded-2xl border border-line bg-white p-8 shadow-sm">
        <Suspense fallback={<LoadingSpinner label="Reading HMRC response…" />}>
          <CallbackFlow />
        </Suspense>
      </div>
    </div>
  );
}
