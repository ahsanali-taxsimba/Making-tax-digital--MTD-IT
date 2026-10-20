"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "./useSession";
import { canAccessPath, homePath, tenantMismatch } from "@/lib/roles";

export function useTenantGuard(route?: { firmId?: string | null; clientId?: string | null }) {
  const { user, ready } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const firmId = route?.firmId ?? null;
  const clientId = route?.clientId ?? null;
  const denied = Boolean(ready && user && (!canAccessPath(user, pathname) || tenantMismatch(user, { firmId, clientId })));

  useEffect(() => {
    if (!ready) {
      return;
    }
    if (!user) {
      if (pathname !== "/login") {
        router.replace("/login");
      }
      return;
    }
    if (tenantMismatch(user, { firmId, clientId })) {
      router.replace("/access-denied");
      return;
    }
    if (!canAccessPath(user, pathname)) {
      router.replace(homePath(user));
    }
  }, [clientId, firmId, pathname, ready, router, user]);

  return { user, ready, denied };
}
