"use client";

import { ProtectedRoute } from "./ProtectedRoute";
import { TenantGuard } from "./TenantGuard";

export function WorkspaceGate({
  children,
  allow,
  firmId,
  clientId,
}: {
  children: React.ReactNode;
  allow?: "platform" | "practice" | "client";
  firmId?: string | null;
  clientId?: string | null;
}) {
  return (
    <ProtectedRoute allow={allow}>
      <TenantGuard firmId={firmId} clientId={clientId}>
        {children}
      </TenantGuard>
    </ProtectedRoute>
  );
}
