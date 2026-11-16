"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ErrorBanner } from "@/components/ErrorBanner";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { WorkspaceGate } from "@/components/WorkspaceGate";
import {
  useAgentConversation,
  useAgentConversations,
  useApplyAgentAction,
  useAskAgent,
  useDismissAgentAction,
} from "@/hooks/useAgent";
import { useSession } from "@/hooks/useSession";
import {
  DEFAULT_AGENT_PROMPTS,
  agentActionKindLabel,
  agentActionStatusLabel,
  canApplyAgentActions,
  isAgentUpgradeError,
  type AgentAction,
  type AgentConversation,
} from "@/lib/agent";
import { formatDateTime } from "@/lib/format";
import { ApiError } from "@/lib/api";
import { canonicalRole } from "@/lib/roles";

export default function PracticeAgentPage() {
  const { user } = useSession();
  return (
    <WorkspaceGate allow="practice" firmId={user?.firmId}>
      <AgentWorkspace />
    </WorkspaceGate>
  );
}

function AgentWorkspace() {
  const { user } = useSession();
  const threads = useAgentConversations();
  const ask = useAskAgent();
  const apply = useApplyAgentAction();
  const dismiss = useDismissAgentAction();
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [draft, setDraft] = useState("");
  const conversation = useAgentConversation(selectedId);
  const canApply = canApplyAgentActions(canonicalRole(user) ?? user?.role);
  const active = conversation.data;
  const prompts = active?.prompts?.length ? active.prompts : DEFAULT_AGENT_PROMPTS;
  const upgrade = isAgentUpgradeError(threads.error as ApiError | undefined);

  useEffect(() => {
    if (selectedId || !threads.data?.length) {
      return;
    }
    setSelectedId(threads.data[0].id);
  }, [selectedId, threads.data]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || ask.isPending) {
      return;
    }
    const result = await ask.mutateAsync({ content, conversationId: selectedId });
    setSelectedId(result.id);
    setDraft("");
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    await send(draft);
  }

  function startNew() {
    setSelectedId(undefined);
    setDraft("");
  }

  if (upgrade) {
    return (
      <div className="space-y-4">
        <Header onNew={startNew} />
        <div className="rounded-2xl border border-line bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-ink">Bookkeeping agent is on Pro and Practice plans</h3>
          <p className="mt-2 max-w-2xl text-sm text-ink-muted">
            Ledger Lite does not include the copilot. Upgrade to review unmatched bank lines, invoice matches, VAT and
            ITSA from one thread — nothing posts until you confirm.
          </p>
          <Link href="/practice/pricing" className="mt-4 inline-flex rounded-xl bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-dark">
            Compare plans
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Header onNew={startNew} llm={active?.llm} />
      {threads.isError ? <ErrorBanner title="Copilot unavailable" message={threads.error.message} /> : null}
      {ask.isError ? <ErrorBanner title="Could not send" message={ask.error.message} /> : null}
      {apply.isError ? <ErrorBanner title="Could not apply" message={apply.error.message} /> : null}
      <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-line bg-white p-3 shadow-sm">
          <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">Threads</p>
          {threads.isLoading ? <LoadingSpinner label="Loading threads…" /> : null}
          <ul className="space-y-1">
            {(threads.data ?? []).map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(row.id)}
                  className={`w-full rounded-xl px-3 py-2 text-left text-sm ${
                    selectedId === row.id ? "bg-teal/10 font-semibold text-teal" : "text-ink hover:bg-paper"
                  }`}
                >
                  <span className="block truncate">{row.title || "Bookkeeping"}</span>
                  <span className="block text-xs font-normal text-ink-muted">{formatDateTime(row.updatedAt)}</span>
                </button>
              </li>
            ))}
          </ul>
          {!threads.isLoading && !(threads.data ?? []).length ? (
            <p className="px-2 py-6 text-sm text-ink-muted">Start with a question below. The agent only reads this firm.</p>
          ) : null}
        </aside>
        <section className="flex min-h-[32rem] flex-col rounded-2xl border border-line bg-white shadow-sm">
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {selectedId && conversation.isLoading ? <LoadingSpinner label="Loading the thread…" /> : null}
            {!active?.messages.length ? (
              <EmptyState prompts={prompts} onPick={(prompt) => void send(prompt)} />
            ) : (
              <Thread
                conversation={active}
                canApply={canApply}
                busy={apply.isPending || dismiss.isPending}
                onApply={(id) => void apply.mutateAsync(id)}
                onDismiss={(id) => void dismiss.mutateAsync(id)}
              />
            )}
          </div>
          <form onSubmit={(event) => void onSubmit(event)} className="border-t border-line p-4">
            <label className="sr-only" htmlFor="agent-draft">
              Ask the bookkeeping agent
            </label>
            <div className="flex gap-3">
              <textarea
                id="agent-draft"
                rows={2}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Ask about unmatched bank, invoices, VAT, ITSA or cash…"
                className="min-h-[3.25rem] flex-1 resize-none rounded-xl border border-line px-3 py-2 text-sm text-ink outline-none focus:border-teal"
              />
              <button
                type="submit"
                disabled={ask.isPending || !draft.trim()}
                className="self-end rounded-xl bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-dark disabled:opacity-50"
              >
                {ask.isPending ? "Thinking…" : "Send"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}

function Header({ onNew, llm }: { onNew: () => void; llm?: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">Bookkeeping</p>
        <h2 className="mt-1 text-2xl font-semibold text-ink">Bookkeeping agent</h2>
        <p className="mt-2 max-w-2xl text-sm text-ink-muted">
          A practice copilot across categorisation, matching, invoices, VAT and ITSA. It reads live ledgers for this firm
          only. Suggested journals stay queued until an accountant applies them.
          {llm ? ` Engine: ${llm}.` : ""}
        </p>
      </div>
      <button
        type="button"
        onClick={onNew}
        className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold text-ink hover:border-teal/40"
      >
        New thread
      </button>
    </div>
  );
}

function EmptyState({ prompts, onPick }: { prompts: string[]; onPick: (prompt: string) => void }) {
  return (
    <div className="flex h-full flex-col justify-center">
      <h3 className="text-lg font-semibold text-ink">What should we look at?</h3>
      <p className="mt-2 max-w-xl text-sm text-ink-muted">
        Ask in plain English. The agent will pull unmatched bank lines, overdue invoices and open VAT/ITSA obligations,
        then queue confirmable action cards — it never auto-posts.
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        {prompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onPick(prompt)}
            className="rounded-full border border-line bg-paper px-3 py-1.5 text-sm text-ink hover:border-teal/40"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}

function Thread({
  conversation,
  canApply,
  busy,
  onApply,
  onDismiss,
}: {
  conversation: AgentConversation;
  canApply: boolean;
  busy: boolean;
  onApply: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const proposed = useMemo(
    () => conversation.actions.filter((row) => row.status === "PROPOSED"),
    [conversation.actions],
  );
  const resolved = useMemo(
    () => conversation.actions.filter((row) => row.status !== "PROPOSED"),
    [conversation.actions],
  );

  return (
    <div className="space-y-4">
      {conversation.messages.map((message) => (
        <article
          key={message.id}
          className={`max-w-3xl rounded-2xl px-4 py-3 text-sm ${
            message.role === "user" ? "ml-auto bg-teal text-white" : "bg-paper text-ink"
          }`}
        >
          <p className="whitespace-pre-wrap">{message.content}</p>
          <p className={`mt-2 text-[11px] ${message.role === "user" ? "text-white/70" : "text-ink-muted"}`}>
            {formatDateTime(message.createdAt)}
          </p>
        </article>
      ))}
      {proposed.length ? (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">Confirm before posting</p>
          {proposed.map((action) => (
            <ActionCard
              key={action.id}
              action={action}
              canApply={canApply}
              busy={busy}
              onApply={onApply}
              onDismiss={onDismiss}
            />
          ))}
        </div>
      ) : null}
      {resolved.length ? (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">Resolved</p>
          {resolved.map((action) => (
            <ActionCard key={action.id} action={action} canApply={false} busy={false} onApply={onApply} onDismiss={onDismiss} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ActionCard({
  action,
  canApply,
  busy,
  onApply,
  onDismiss,
}: {
  action: AgentAction;
  canApply: boolean;
  busy: boolean;
  onApply: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const open = action.status === "PROPOSED";
  return (
    <article className="rounded-2xl border border-line bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">
            {agentActionKindLabel(action.kind)} · {agentActionStatusLabel(action.status)}
          </p>
          <h4 className="mt-1 font-semibold text-ink">{action.title}</h4>
          <p className="mt-1 text-sm text-ink-muted">{action.summary}</p>
        </div>
        {open ? (
          <div className="flex gap-2">
            {canApply ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => onApply(action.id)}
                className="rounded-xl bg-teal px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-dark disabled:opacity-50"
              >
                Apply
              </button>
            ) : (
              <p className="text-xs text-ink-muted">An accountant must apply this.</p>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => onDismiss(action.id)}
              className="rounded-xl border border-line px-3 py-1.5 text-sm font-semibold text-ink hover:border-teal/40 disabled:opacity-50"
            >
              Dismiss
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}
