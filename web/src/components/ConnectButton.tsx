"use client";

import Link from "next/link";

export function ConnectButton({
  clientId,
  environment,
  disabled,
}: {
  clientId?: string | null;
  environment: string;
  disabled?: boolean;
}) {
  const href = clientId ? `/vat/connect?clientId=${clientId}&environment=${environment}` : "/vat/connect";
  return (
    <Link
      href={href}
      aria-disabled={disabled || !clientId}
      className={`inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm ${
        disabled || !clientId ? "pointer-events-none bg-slate-400" : "bg-teal hover:bg-teal-dark"
      }`}
    >
      Connect to HMRC VAT
    </Link>
  );
}
