"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "@/hooks/useSession";
import { homePath } from "@/lib/roles";
import { isPracticeStaff } from "@/lib/session";
import { LoadingSpinner } from "./LoadingSpinner";
import { RequireAuth } from "./RequireAuth";

export function RequireStaff({ children }: { children: React.ReactNode }) {
  const { ready, user } = useSession();
  const router = useRouter();
  const staff = isPracticeStaff(user?.role, user);

  useEffect(() => {
    if (ready && user && !staff) {
      router.replace(homePath(user));
    }
  }, [ready, router, staff, user]);

  return (
    <RequireAuth>
      {!ready || !user ? (
        <div className="py-16">
          <LoadingSpinner label="Opening the practice workspace…" />
        </div>
      ) : staff ? (
        children
      ) : null}
    </RequireAuth>
  );
}
