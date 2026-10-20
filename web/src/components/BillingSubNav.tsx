"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/practice/pricing", label: "Pricing" },
  { href: "/practice/billing", label: "Billing" },
  { href: "/practice/subscription", label: "Subscription" },
  { href: "/practice/invoices", label: "Invoice history" },
];

export function BillingSubNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-2">
      {ITEMS.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${active ? "bg-teal text-white" : "border border-line bg-white text-ink hover:border-teal/40"}`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
