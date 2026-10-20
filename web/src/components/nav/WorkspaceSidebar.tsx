"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { logout } from "@/lib/auth";
import { useSession } from "@/hooks/useSession";
import { canonicalRole, canonicalRoleLabel, navActive, type NavItem } from "@/lib/roles";

export function WorkspaceSidebar({
  brand,
  eyebrow,
  items,
  tone = "teal",
}: {
  brand: string;
  eyebrow: string;
  items: NavItem[];
  tone?: "teal" | "ink";
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useSession();
  const role = canonicalRole(user);
  const dark = tone === "teal";

  return (
    <aside className={`flex w-60 shrink-0 flex-col border-r ${dark ? "border-white/10 bg-teal text-white" : "border-line bg-ink text-white"}`}>
      <Link href={items[0]?.href ?? "/"} className="flex items-center gap-3 px-5 py-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 text-sm font-bold">MT</span>
        <span>
          <span className="block text-sm font-semibold">{brand}</span>
          <span className="block text-xs text-white/70">{eyebrow}</span>
        </span>
      </Link>
      <nav className="flex flex-1 flex-col gap-0.5 px-3" aria-label={eyebrow}>
        {items.map((item) => {
          const active = navActive(pathname, item.href, item.match);
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
        <p className="mt-0.5">{canonicalRoleLabel(role ?? user?.role)}</p>
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
