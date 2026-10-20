"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "@/hooks/useSession";
import { isPracticeStaff } from "@/lib/session";
import { LoadingSpinner } from "./LoadingSpinner";
import { RequireAuth } from "./RequireAuth";

export function RequireStaff({ children }: { children: React.ReactNode }) {
  const { ready, user } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (ready && user && !isPracticeStaff(user.role)) {
      router.replace("/portal");
    }
  }, [ready, router, user]);

  return (
    <RequireAuth>
      {!ready || !user ? (
        <div className="py-16">
          <LoadingSpinner label="Opening the practice workspace…" />
        </div>
      ) : isPracticeStaff(user.role) ? (
        children
      ) : null}
    </RequireAuth>
  );
}
