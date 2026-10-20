"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { hmrcUserMessage } from "@/lib/errors";
import { safeHmrcRedirect, shouldCompleteLocally, startHmrcOAuth } from "@/lib/hmrc";
import { getEnvironment, getSelectedClientId } from "@/lib/session";
import { ErrorBanner } from "@/components/ErrorBanner";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { RequireAuth } from "@/components/RequireAuth";

function ConnectFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const clientId = params.get("clientId") || getSelectedClientId();
    const environment = params.get("environment") || getEnvironment();
    if (!clientId) {
      setError("Select a client before connecting to HMRC.");
      return;
    }

    let cancelled = false;
    startHmrcOAuth(clientId, environment)
      .then((started) => {
        if (cancelled) {
          return;
        }
        if (shouldCompleteLocally(started)) {
          const next = new URLSearchParams({
            code: "sandbox-code",
            state: started.state,
            environment: environment,
          });
          router.replace(`/vat/callback?${next.toString()}`);
          return;
        }
        window.location.assign(safeHmrcRedirect(started.authorizationUrl));
      })
      .catch((err: unknown) => {
        if (cancelled) {
          return;
        }
        setError(
          hmrcUserMessage(
            err instanceof ApiError ? err.errorCode : undefined,
            err instanceof Error ? err.message : "HMRC returned an error during authorisation.",
          ),
        );
      });

    return () => {
      cancelled = true;
    };
  }, [params, router]);

  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-line bg-white p-8 text-center shadow-sm">
      {error ? (
        <ErrorBanner title="Unable to start HMRC authorisation" message={error} />
      ) : (
        <div className="flex flex-col items-center gap-4">
          <LoadingSpinner label="Redirecting to HMRC…" />
          <p className="text-sm text-ink-muted">
            You will be sent to HMRC to approve VAT access. Tokens are stored only on the server.
          </p>
        </div>
      )}
    </div>
  );
}

export default function VatConnectPage() {
  return (
    <RequireAuth>
      <h1 className="mb-6 text-2xl font-semibold">Connect to HMRC VAT</h1>
      <Suspense fallback={<LoadingSpinner label="Preparing HMRC authorisation…" />}>
        <ConnectFlow />
      </Suspense>
    </RequireAuth>
  );
}
