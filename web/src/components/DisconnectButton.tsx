"use client";

import { useState } from "react";
import { ApiError } from "@/lib/api";
import { hmrcUserMessage } from "@/lib/errors";
import { regimeLabel, type HmrcRegime } from "@/lib/regime";
import { useDisconnectHmrc } from "@/hooks/useHmrcStatus";

export function DisconnectButton({
  clientId,
  environment,
  disabled,
  regime = "vat",
}: {
  clientId?: string | null;
  environment: string;
  disabled?: boolean;
  regime?: HmrcRegime;
}) {
  const disconnect = useDisconnectHmrc(clientId, environment);
  const [error, setError] = useState<string | null>(null);
  const label = regimeLabel(regime);

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={disabled || !clientId || disconnect.isPending}
        onClick={() => {
          if (
            !window.confirm(
              `Disconnect this client from HMRC ${label}? They will need to authorise again before the next submission.`,
            )
          ) {
            return;
          }
          setError(null);
          disconnect.mutate(undefined, {
            onError: (err) => {
              const code = err instanceof ApiError ? err.errorCode : undefined;
              setError(hmrcUserMessage(code, err instanceof Error ? err.message : "Unable to disconnect.", regime));
            },
          });
        }}
        className="inline-flex items-center justify-center rounded-xl border border-danger/30 bg-white px-4 py-2.5 text-sm font-semibold text-danger hover:bg-danger-soft disabled:cursor-not-allowed disabled:opacity-50"
      >
        {disconnect.isPending ? "Disconnecting…" : `Disconnect HMRC ${label}`}
      </button>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
