"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { logout } from "@/lib/auth";
import { useSession } from "@/hooks/useSession";

const LINKS = [
  { href: "/practice", label: "Dashboard", exact: true },
  { href: "/practice/staff", label: "Staff" },
  { href: "/practice/clients", label: "Clients" },
  { href: "/practice/tasks", label: "Workflow" },
  { href: "/practice/hmrc", label: "HMRC" },
  { href: "/vat", label: "VAT" },
  { href: "/itsa", label: "ITSA" },
  { href: "/portal", label: "Portal" },
];

export function GlobalNavSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useSession();

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-line bg-teal text-white">
      <Link href="/practice" className="flex items-center gap-3 px-5 py-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 text-sm font-bold">MT</span>
        <span>
          <span className="block text-sm font-semibold">Northbridge</span>
          <span className="block text-xs text-white/70">Practice workspace</span>
        </span>
      </Link>
      <nav className="flex flex-1 flex-col gap-0.5 px-3" aria-label="Practice">
        {LINKS.map((item) => {
          const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg px-3 py-2 text-sm font-medium ${
                active ? "bg-white text-teal" : "text-white/80 hover:bg-white/10 hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 px-5 py-4 text-xs text-white/70">
        <p className="font-medium text-white">{user?.name}</p>
        <p className="mt-0.5 capitalize">{user?.role.toLowerCase()}</p>
        <button
          type="button"
          className="mt-3 text-sm text-white underline-offset-2 hover:underline"
          onClick={async () => {
            await logout();
            router.replace("/login");
          }}
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
