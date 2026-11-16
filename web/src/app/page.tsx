"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "@/hooks/useSession";
import { homePath } from "@/lib/roles";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { RequireAuth } from "@/components/RequireAuth";

export default function HomePage() {
  const { user } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.replace(homePath(user));
    }
  }, [router, user]);

  return (
    <RequireAuth>
      <div className="py-16">
        <LoadingSpinner label="Opening your workspace…" />
      </div>
    </RequireAuth>
  );
}
