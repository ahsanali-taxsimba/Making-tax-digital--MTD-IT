"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function ReceiptsSubNav({ basePath }: { basePath: string }) {
  const pathname = usePathname();
  const items = [
    { href: basePath, label: "Dashboard", exact: true },
    { href: `${basePath}/upload`, label: "Upload" },
  ];
  return (
    <nav className="flex flex-wrap gap-2" aria-label="Receipts">
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-xl px-4 py-2 text-sm font-semibold ${
              active ? "bg-teal text-white" : "border border-line bg-white text-ink hover:border-teal/40"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
