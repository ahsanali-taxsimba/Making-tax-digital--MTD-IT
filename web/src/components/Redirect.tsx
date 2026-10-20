"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { LoadingSpinner } from "./LoadingSpinner";

export function Redirect({ href }: { href: string }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(href);
  }, [href, router]);
  return (
    <div className="py-16">
      <LoadingSpinner label="Redirecting…" />
    </div>
  );
}
