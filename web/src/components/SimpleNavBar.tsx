"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/portal", label: "Home", match: (path: string) => path === "/portal" },
  { href: "/portal/vat", label: "VAT", match: (path: string) => path.startsWith("/portal/vat") },
  { href: "/portal/itsa", label: "ITSA", match: (path: string) => path.startsWith("/portal/itsa") },
  { href: "/portal/documents", label: "Documents", match: (path: string) => path.startsWith("/portal/documents") },
  { href: "/portal/messages", label: "Messages", match: (path: string) => path.startsWith("/portal/messages") },
];

export function SimpleNavBar() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap items-center gap-1" aria-label="Client portal">
      {LINKS.map((link) => {
        const active = link.match(pathname);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
              active ? "bg-teal text-white" : "text-ink-muted hover:bg-paper hover:text-ink"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
