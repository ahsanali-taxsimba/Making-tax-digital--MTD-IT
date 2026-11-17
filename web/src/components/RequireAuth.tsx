"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "@/hooks/useSession";
import { LoadingSpinner } from "./LoadingSpinner";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { ready, isAuthenticated } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (ready && !isAuthenticated) {
      router.replace("/login");
    }
  }, [ready, isAuthenticated, router]);

  if (!ready) {
    return (
      <div className="py-16">
        <LoadingSpinner label="Restoring your session…" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
