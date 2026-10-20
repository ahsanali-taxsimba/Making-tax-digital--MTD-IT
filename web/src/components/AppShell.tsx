"use client";

import Link from "next/link";
import { Suspense } from "react";
import { usePathname, useRouter } from "next/navigation";
import { logout } from "@/lib/auth";
import { useSession } from "@/hooks/useSession";
import { isPracticeStaff } from "@/lib/session";
import { GlobalNavSidebar } from "./GlobalNavSidebar";
import { SimpleNavBar } from "./SimpleNavBar";
import { TopBar } from "./TopBar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const staff = isPracticeStaff(user?.role);
  const loginPage = pathname === "/login";

  if (loginPage || !user) {
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
                <span className="block text-xs text-ink-muted">Practice workspace</span>
              </span>
            </Link>
            {user ? (
              <button
                type="button"
                className="text-sm text-teal underline-offset-2 hover:underline"
                onClick={async () => {
                  await logout();
                  router.replace("/login");
                }}
              >
                Sign out
              </button>
            ) : (
              <Link href="/login" className="text-sm font-semibold text-teal">
                Sign in
              </Link>
            )}
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
      </div>
    );
  }

  if (user.role === "CLIENT") {
    return (
      <div className="min-h-screen">
        <header className="border-b border-line bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
            <div className="flex flex-wrap items-center gap-6">
              <Link href="/portal" className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal text-sm font-bold text-white">
                  MT
                </span>
                <span>
                  <span className="block text-sm font-semibold text-ink">Making Tax Digital</span>
                  <span className="block text-xs text-ink-muted">Client portal</span>
                </span>
              </Link>
              <SimpleNavBar />
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-ink-muted">
                {user.name} · {user.role.toLowerCase()}
              </span>
              <button
                type="button"
                className="text-teal underline-offset-2 hover:underline"
                onClick={async () => {
                  await logout();
                  router.replace("/login");
                }}
              >
                Sign out
              </button>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {staff ? <GlobalNavSidebar /> : null}
      <div className="flex min-w-0 flex-1 flex-col">
        <Suspense fallback={<div className="h-[73px] border-b border-line bg-white" />}>
          <TopBar />
        </Suspense>
        <main className="flex-1 px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
