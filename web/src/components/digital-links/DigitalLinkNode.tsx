"use client";

import { statusTone, type TimelineNode } from "@/lib/digital-links";

export function DigitalLinkNode({
  node,
  last,
  selected,
  onSelect,
}: {
  node: TimelineNode;
  last?: boolean;
  selected?: boolean;
  onSelect: (node: TimelineNode) => void;
}) {
  const tone = statusTone(node.status);
  return (
    <li className="relative flex gap-4">
      <div className="relative flex w-7 shrink-0 justify-center">
        {!last ? <span className="absolute top-8 bottom-[-0.75rem] w-0.5 bg-ink/20" aria-hidden /> : null}
        <span className={`relative z-10 mt-4 flex h-7 w-7 items-center justify-center rounded-full ${tone.dot}`}>
          <span className="h-2.5 w-2.5 rounded-full bg-white" />
        </span>
      </div>
      <button
        type="button"
        onClick={() => onSelect(node)}
        className={`min-w-0 flex-1 rounded-2xl border px-4 py-4 text-left ${
          selected ? "border-teal bg-teal/5" : "border-line bg-white hover:border-teal/40"
        }`}
      >
        <span className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-semibold text-ink">{node.title}</span>
          <span className={`text-xs font-semibold ${tone.text}`}>{tone.label}</span>
        </span>
        <span className="mt-1 block truncate text-sm text-ink-muted">{node.subtitle}</span>
        <span className="mt-1 block font-mono text-[11px] text-ink-muted">{node.id ?? "Not linked"}</span>
      </button>
    </li>
  );
}
