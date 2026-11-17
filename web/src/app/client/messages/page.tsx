"use client";

import { MessagesThread } from "@/components/MessagesThread";
import { WorkspaceGate } from "@/components/WorkspaceGate";
import { useMessages } from "@/hooks/useMessages";
import { useSession } from "@/hooks/useSession";

export default function ClientMessagesPage() {
  const { user } = useSession();
  const clientId = user?.clientId ?? null;
  const messages = useMessages(clientId);

  return (
    <WorkspaceGate allow="client" clientId={clientId}>
      <div className="space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">Notes</p>
          <h1 className="mt-1 text-3xl font-semibold text-ink">Messages</h1>
          <p className="mt-2 text-sm text-ink-muted">A thread between you and your accountant about your own record.</p>
        </div>
        <MessagesThread messages={messages.data} isLoading={messages.isLoading} clientId={clientId} />
      </div>
    </WorkspaceGate>
  );
}
