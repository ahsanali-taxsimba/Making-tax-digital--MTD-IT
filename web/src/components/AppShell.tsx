"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { logout } from "@/lib/auth";
import { useSession } from "@/hooks/useSession";
import { ClientPicker } from "./ClientPicker";
import { SimpleNavBar } from "./SimpleNavBar";

function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
        active ? "bg-teal text-white" : "text-ink-muted hover:bg-paper hover:text-ink"
      }`}
    >
      {label}
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user } = useSession();
  const router = useRouter();

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex flex-wrap items-center gap-6">
            <Link href="/" className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal text-sm font-bold text-white">
                MT
              </span>
              <span>
                <span className="block text-sm font-semibold text-ink">Making Tax Digital</span>
                <span className="block text-xs text-ink-muted">HMRC VAT &amp; ITSA</span>
              </span>
            </Link>
            {user?.role === "CLIENT" ? (
              <SimpleNavBar />
            ) : user ? (
              <nav className="flex items-center gap-1" aria-label="Practice">
                <NavLink href="/vat" label="VAT" />
                <NavLink href="/itsa" label="ITSA" />
                <NavLink href="/portal" label="Portal" />
              </nav>
            ) : null}
          </div>
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
