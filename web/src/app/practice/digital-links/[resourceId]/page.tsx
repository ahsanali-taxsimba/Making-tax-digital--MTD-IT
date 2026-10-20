"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { DigitalLinksTimeline } from "@/components/digital-links/DigitalLinksTimeline";
import { ErrorBanner } from "@/components/ErrorBanner";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { WorkspaceGate } from "@/components/WorkspaceGate";
import { useDigitalLinks } from "@/hooks/useDigitalLinks";
import { useSession } from "@/hooks/useSession";
import { timelineNodes, type TimelineNode } from "@/lib/digital-links";

export default function PracticeDigitalLinksPage() {
  const { user } = useSession();
  const params = useParams<{ resourceId: string }>();
  const resourceId = params.resourceId;
  const query = useDigitalLinks(resourceId);
  const [selectedKind, setSelectedKind] = useState<TimelineNode["kind"]>("document");
  const selected = useMemo(() => {
    if (!query.data) {
      return null;
    }
    const nodes = timelineNodes(query.data);
    return nodes.find((node) => node.kind === selectedKind) ?? nodes[0];
  }, [query.data, selectedKind]);

  return (
    <WorkspaceGate allow="practice" firmId={user?.firmId}>
      <div className="space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">Digital links</p>
          <h2 className="mt-1 text-2xl font-semibold text-ink">HMRC digital link timeline</h2>
          <p className="mt-2 max-w-2xl text-sm text-ink-muted">
            Trace Document → Bank transaction → Journal entry → VAT return for this resource. Green is linked, amber is
            partial, red is missing.
          </p>
          <p className="mt-2 font-mono text-xs text-ink-muted">{resourceId}</p>
        </div>
        {query.isError ? <ErrorBanner title="Digital links unavailable" message={query.error.message} /> : null}
        {query.isLoading ? <LoadingSpinner label="Loading digital links…" /> : null}
        {query.data && selected ? (
          <DigitalLinksTimeline
            links={query.data}
            selected={selected}
            onSelect={(node) => setSelectedKind(node.kind)}
          />
        ) : null}
        <Link href="/practice/digital-links" className="inline-block text-sm font-semibold text-teal hover:underline">
          Back to digital links
        </Link>
      </div>
    </WorkspaceGate>
  );
}
