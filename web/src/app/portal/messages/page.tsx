"use client";

import { useClient } from "@/hooks/useClient";
import { useMessages } from "@/hooks/useMessages";
import { useSession } from "@/hooks/useSession";
import { MessagesThread } from "@/components/MessagesThread";
import { RequireAuth } from "@/components/RequireAuth";

export default function PortalMessagesPage() {
  const { clientId, user } = useSession();
  const client = useClient();
  const resolvedId = client.data?.id ?? clientId ?? user?.clientId;
  const messages = useMessages(resolvedId);

  return (
    <RequireAuth>
      <div className="space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">Notes</p>
          <h1 className="mt-1 text-3xl font-semibold">Messages</h1>
          <p className="mt-2 text-sm text-ink-muted">A simple thread between you and your accountant.</p>
        </div>
        <MessagesThread messages={messages.data} isLoading={messages.isLoading} clientId={resolvedId} />
      </div>
    </RequireAuth>
  );
}
