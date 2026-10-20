"use client";

import { itsaTimelineNodes, type ItsaTimelineNode } from "@/lib/digital-links-itsa";
import type { DigitalLinks } from "@/lib/audit";
import { DigitalLinkDetailPanelITSA } from "./DigitalLinkDetailPanelITSA";
import { DigitalLinkNodeITSA } from "./DigitalLinkNodeITSA";

export function DigitalLinksTimelineITSA({
  links,
  selected,
  onSelect,
}: {
  links: DigitalLinks;
  selected: ItsaTimelineNode;
  onSelect: (node: ItsaTimelineNode) => void;
}) {
  const nodes = itsaTimelineNodes(links);
  return (
    <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
      <ol className="space-y-3">
        {nodes.map((node, index) => (
          <DigitalLinkNodeITSA
            key={node.kind}
            node={node}
            last={index === nodes.length - 1}
            selected={selected.kind === node.kind}
            onSelect={onSelect}
          />
        ))}
      </ol>
      <DigitalLinkDetailPanelITSA node={selected} links={links} />
    </div>
  );
}
