"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { logout } from "@/lib/auth";
import { useSession } from "@/hooks/useSession";
import { ClientPicker } from "./ClientPicker";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user } = useSession();
  const router = useRouter();

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <Link href="/vat" className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal text-sm font-bold text-white">
              MT
            </span>
            <span>
              <span className="block text-sm font-semibold text-ink">Making Tax Digital</span>
              <span className="block text-xs text-ink-muted">HMRC VAT connection</span>
            </span>
          </Link>
          <div className="flex flex-wrap items-center gap-4">
            <ClientPicker />
            {user ? (
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
            ) : (
              <Link href="/login" className="text-sm font-semibold text-teal">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
