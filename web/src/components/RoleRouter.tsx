"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useSession } from "@/hooks/useSession";
import { useTenantGuard } from "@/hooks/useTenantGuard";
import { canonicalRole, isFirmStaffRole, isPlatformRole } from "@/lib/roles";
import { AccessDenied } from "./AccessDenied";
import { AdminConsoleLayout } from "./layouts/AdminConsoleLayout";
import { ClientPortalLayout } from "./layouts/ClientPortalLayout";
import { PracticeDashboardLayout } from "./layouts/PracticeDashboardLayout";

function PublicChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/login" className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal text-sm font-bold text-white">
              MT
            </span>
            <span>
              <span className="block text-sm font-semibold text-ink">Making Tax Digital</span>
              <span className="block text-xs text-ink-muted">Role-based workspaces</span>
            </span>
          </Link>
          <Link href="/login" className="text-sm font-semibold text-teal">
            Sign in
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}

export function RoleRouter({ children }: { children: React.ReactNode }) {
  const { user } = useSession();
  const pathname = usePathname();
  const params = useSearchParams();
  const role = canonicalRole(user);
  useTenantGuard({
    firmId: params.get("firmId"),
    clientId: params.get("clientId"),
  });

  if (!user || pathname === "/login") {
    return <PublicChrome>{children}</PublicChrome>;
  }

  if (pathname === "/access-denied") {
    return <div className="min-h-screen bg-paper px-6 py-16">{children}</div>;
  }

  if (role && isPlatformRole(role)) {
    return <AdminConsoleLayout>{children}</AdminConsoleLayout>;
  }

  if (role && isFirmStaffRole(role)) {
    return <PracticeDashboardLayout firmId={user.firmId}>{children}</PracticeDashboardLayout>;
  }

  if (role === "firm_client") {
    return <ClientPortalLayout clientId={user.clientId}>{children}</ClientPortalLayout>;
  }

  return (
    <div className="min-h-screen bg-paper px-6 py-16">
      <AccessDenied />
    </div>
  );
}
