"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { DigitalLinksTimelineITSA } from "@/components/digital-links-itsa/DigitalLinksTimelineITSA";
import { ErrorBanner } from "@/components/ErrorBanner";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { WorkspaceGate } from "@/components/WorkspaceGate";
import { useDigitalLinksITSA } from "@/hooks/useDigitalLinksITSA";
import { useSession } from "@/hooks/useSession";
import { itsaTimelineNodes, type ItsaTimelineNode } from "@/lib/digital-links-itsa";

export default function PracticeItsaDigitalLinksPage() {
  const { user } = useSession();
  const params = useParams<{ resourceId: string }>();
  const resourceId = params.resourceId;
  const query = useDigitalLinksITSA(resourceId);
  const [selectedKind, setSelectedKind] = useState<ItsaTimelineNode["kind"]>("document");
  const selected = useMemo(() => {
    if (!query.data) {
      return null;
    }
    const nodes = itsaTimelineNodes(query.data);
    return nodes.find((node) => node.kind === selectedKind) ?? nodes[0];
  }, [query.data, selectedKind]);

  return (
    <WorkspaceGate allow="practice" firmId={user?.firmId}>
      <div className="space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">Digital links · ITSA</p>
          <h2 className="mt-1 text-2xl font-semibold text-ink">HMRC ITSA digital link timeline</h2>
          <p className="mt-2 max-w-2xl text-sm text-ink-muted">
            Trace Document → Bank transaction → Journal entry → Quarterly update → EOPS → Final declaration. Green is
            linked, amber is partial, red is missing.
          </p>
          <p className="mt-2 font-mono text-xs text-ink-muted">{resourceId}</p>
        </div>
        {query.isError ? <ErrorBanner title="ITSA digital links unavailable" message={query.error.message} /> : null}
        {query.isLoading ? <LoadingSpinner label="Loading ITSA digital links…" /> : null}
        {query.data && selected ? (
          <DigitalLinksTimelineITSA
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
