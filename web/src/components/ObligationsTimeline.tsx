import Link from "next/link";
import { formatDate } from "@/lib/format";

export interface TimelineItem {
  id: string;
  title: string;
  due?: string | null;
  status: string;
  href?: string;
}

export function ObligationsTimeline({ items }: { items: TimelineItem[] }) {
  if (!items.length) {
    return <p className="text-sm text-ink-muted">Nothing is waiting for you right now.</p>;
  }
  return (
    <ol className="space-y-3">
      {items.map((item) => (
        <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white px-4 py-3">
          <div>
            <p className="font-medium text-ink">{item.title}</p>
            <p className="text-sm text-ink-muted">Due {formatDate(item.due)}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold uppercase text-amber-800">
              {item.status.replace(/[_-]+/g, " ")}
            </span>
            {item.href ? (
              <Link href={item.href} className="text-sm font-semibold text-teal hover:underline">
                Open
              </Link>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
