"use client";

import { useTenantGuard } from "@/hooks/useTenantGuard";
import { LoadingSpinner } from "./LoadingSpinner";

export function TenantGuard({
  children,
  firmId,
  clientId,
}: {
  children: React.ReactNode;
  firmId?: string | null;
  clientId?: string | null;
}) {
  const { ready, user, denied } = useTenantGuard({ firmId, clientId });
  if (!ready || !user) {
    return (
      <div className="py-16">
        <LoadingSpinner label="Checking tenant access…" />
      </div>
    );
  }
  if (denied) {
    return null;
  }
  return <>{children}</>;
}
