"use client";

import { timelineNodes, type TimelineNode } from "@/lib/digital-links";
import type { DigitalLinks } from "@/lib/audit";
import { DigitalLinkDetailPanel } from "./DigitalLinkDetailPanel";
import { DigitalLinkNode } from "./DigitalLinkNode";

export function DigitalLinksTimeline({
  links,
  selected,
  onSelect,
}: {
  links: DigitalLinks;
  selected: TimelineNode;
  onSelect: (node: TimelineNode) => void;
}) {
  const nodes = timelineNodes(links);
  return (
    <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
      <ol className="space-y-3">
        {nodes.map((node, index) => (
          <DigitalLinkNode
            key={node.kind}
            node={node}
            last={index === nodes.length - 1}
            selected={selected.kind === node.kind}
            onSelect={onSelect}
          />
        ))}
      </ol>
      <DigitalLinkDetailPanel node={selected} links={links} />
    </div>
  );
}
