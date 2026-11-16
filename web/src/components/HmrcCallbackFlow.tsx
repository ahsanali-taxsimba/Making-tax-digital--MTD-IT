"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { ApiError } from "@/lib/api";
import { hmrcUserMessage } from "@/lib/errors";
import { OAUTH_RETURN_TO_KEY, regimeFromPath, regimeLabel, regimePath, type HmrcRegime } from "@/lib/regime";
import { useHmrcCallback } from "@/hooks/useHmrcCallback";
import { ErrorBanner } from "./ErrorBanner";
import { LoadingSpinner } from "./LoadingSpinner";
import { SuccessBanner } from "./SuccessBanner";

export function HmrcCallbackFlow({ regime }: { regime?: HmrcRegime }) {
  const router = useRouter();
  const params = useSearchParams();
  const code = params.get("code") ?? undefined;
  const state = params.get("state") ?? undefined;
  const environment = params.get("environment") ?? undefined;
  const error = params.get("error") ?? undefined;
  const errorDescription = params.get("error_description") ?? undefined;
  const storedReturnTo = typeof window !== "undefined" ? window.sessionStorage.getItem(OAUTH_RETURN_TO_KEY) : null;
  const resolvedRegime = regime ?? regimeFromPath(storedReturnTo);
  const callback = useHmrcCallback({
    code,
    state,
    environment,
    error,
    error_description: errorDescription,
  });
  const returnTo = storedReturnTo || regimePath(resolvedRegime);

  useEffect(() => {
    if (callback.isSuccess) {
      window.sessionStorage.removeItem(OAUTH_RETURN_TO_KEY);
      const timer = window.setTimeout(() => router.replace(returnTo), 1400);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [callback.isSuccess, returnTo, router]);

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
          resolvedRegime,
        )}
      />
    );
  }

  return (
    <SuccessBanner
      title={`HMRC ${regimeLabel(resolvedRegime)} connected`}
      message={`The access token is stored encrypted on the server. Taking you back to the ${regimeLabel(resolvedRegime)} dashboard.`}
    />
  );
}
