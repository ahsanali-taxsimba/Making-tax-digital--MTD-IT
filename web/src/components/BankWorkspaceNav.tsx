"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BANK_WORKSPACE_TABS } from "@/lib/bank-workspace";

export function BankWorkspaceNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-2" aria-label="Bank feed workspace">
      {BANK_WORKSPACE_TABS.map((tab) => {
        const active = pathname === tab.match || pathname.startsWith(`${tab.match}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-xl px-4 py-2 text-sm font-semibold ${
              active ? "bg-teal text-white" : "border border-line bg-white text-ink hover:border-teal/40"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
