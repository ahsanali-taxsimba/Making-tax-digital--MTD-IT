"use client";

import Link from "next/link";
import { regimeLabel, regimePath, type HmrcRegime } from "@/lib/regime";

export function ConnectButton({
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
  const base = `${regimePath(regime)}/connect`;
  const href = clientId ? `${base}?clientId=${clientId}&environment=${environment}` : base;
  return (
    <Link
      href={href}
      aria-disabled={disabled || !clientId}
      className={`inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm ${
        disabled || !clientId ? "pointer-events-none bg-slate-400" : "bg-teal hover:bg-teal-dark"
      }`}
    >
      Connect to HMRC {regimeLabel(regime)}
    </Link>
  );
}
