"use client";

import Link from "next/link";
import { homePath } from "@/lib/roles";
import { useSession } from "@/hooks/useSession";

export function AccessDenied() {
  const { user } = useSession();
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-line bg-white p-8 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">Access denied</p>
      <h1 className="mt-2 text-2xl font-semibold text-ink">You cannot open this workspace</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Platform staff stay in the admin console, firms stay in their own practice, and clients only see their own portal.
      </p>
      <Link href={homePath(user)} className="mt-6 inline-flex rounded-xl bg-teal px-4 py-2 text-sm font-semibold text-white">
        Go to your home
      </Link>
    </div>
  );
}
