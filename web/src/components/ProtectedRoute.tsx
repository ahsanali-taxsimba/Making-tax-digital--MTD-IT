"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "@/hooks/useSession";
import { canAccessPath, canonicalRole, homePath, isFirmStaffRole, isPlatformRole } from "@/lib/roles";
import { LoadingSpinner } from "./LoadingSpinner";

function matchesAllow(userRole: ReturnType<typeof canonicalRole>, allow?: "platform" | "practice" | "client") {
  if (!allow || !userRole) {
    return Boolean(userRole);
  }
  if (allow === "platform") {
    return isPlatformRole(userRole);
  }
  if (allow === "practice") {
    return isFirmStaffRole(userRole);
  }
  return userRole === "firm_client";
}

export function ProtectedRoute({
  children,
  allow,
}: {
  children: React.ReactNode;
  allow?: "platform" | "practice" | "client";
}) {
  const { user, ready } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const role = canonicalRole(user);
  const allowed = Boolean(user && canAccessPath(user, pathname) && matchesAllow(role, allow));

  useEffect(() => {
    if (!ready) {
      return;
    }
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!canAccessPath(user, pathname) || !matchesAllow(canonicalRole(user), allow)) {
      router.replace(homePath(user));
    }
  }, [allow, pathname, ready, router, user]);

  if (!ready || !user) {
    return (
      <div className="py-16">
        <LoadingSpinner label="Checking your access…" />
      </div>
    );
  }

  return allowed ? <>{children}</> : null;
}
