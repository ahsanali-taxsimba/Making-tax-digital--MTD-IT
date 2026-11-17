"use client";

import { FormEvent, useState } from "react";
import { formatDate } from "@/lib/format";
import type { PortalMessage } from "@/lib/types";
import { useSendMessage } from "@/hooks/useMessages";
import { ErrorBanner } from "./ErrorBanner";
import { LoadingSpinner } from "./LoadingSpinner";

export function MessagesThread({
  messages,
  isLoading,
  clientId,
}: {
  messages?: PortalMessage[];
  isLoading: boolean;
  clientId?: string | null;
}) {
  const send = useSendMessage(clientId);
  const [body, setBody] = useState("");

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!body.trim()) {
      return;
    }
    send.mutate(body.trim(), {
      onSuccess: () => setBody(""),
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-2xl border border-line bg-white p-4">
        {isLoading ? <LoadingSpinner label="Loading messages…" /> : null}
        {!isLoading && !messages?.length ? <p className="text-sm text-ink-muted">No notes yet. Send the first message.</p> : null}
        {messages?.map((item) => (
          <article key={item.id} className="rounded-xl bg-paper px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              {item.authorName} · {item.authorRole.toLowerCase()} · {formatDate(item.createdAt)}
            </p>
            <p className="mt-1 text-sm text-ink">{item.body}</p>
          </article>
        ))}
      </div>
      {send.isError ? <ErrorBanner title="Not sent" message="Your note could not be posted." /> : null}
      <form onSubmit={onSubmit} className="space-y-3">
        <textarea
          className="w-full rounded-xl border border-line px-3 py-2 text-sm"
          rows={3}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Write a note to your accountant…"
          required
        />
        <button
          type="submit"
          disabled={send.isPending}
          className="rounded-xl bg-teal px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-dark disabled:opacity-60"
        >
          {send.isPending ? "Sending…" : "Send note"}
        </button>
      </form>
    </div>
  );
}
