"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { LandingPage } from "@/components/LandingPage";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useSession } from "@/hooks/useSession";
import { homePath } from "@/lib/roles";

export default function HomePage() {
  const { user, ready } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (ready && user) {
      router.replace(homePath(user));
    }
  }, [ready, router, user]);

  if (!ready || user) {
    return (
      <div className="py-16">
        <LoadingSpinner label={user ? "Opening your workspace…" : "Loading…"} />
      </div>
    );
  }

  return <LandingPage />;
}
