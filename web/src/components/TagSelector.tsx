"use client";

import { FormEvent, useState } from "react";
import type { ReceiptTag } from "@/lib/receipts";

export function TagSelector({
  value,
  catalog = [],
  disabled,
  pending,
  onChange,
  onSave,
}: {
  value: string[];
  catalog?: ReceiptTag[];
  disabled?: boolean;
  pending?: boolean;
  onChange: (tags: string[]) => void;
  onSave?: (tags: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const unused = catalog.filter((tag) => !value.includes(tag.name));

  function add(name: string) {
    const next = name.trim();
    if (!next || value.includes(next)) {
      return;
    }
    onChange([...value, next]);
    setDraft("");
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    add(draft);
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {value.length ? (
          value.map((tag) => (
            <button
              key={tag}
              type="button"
              disabled={disabled}
              onClick={() => onChange(value.filter((item) => item !== tag))}
              className="rounded-full bg-teal/10 px-3 py-1 text-sm font-medium text-teal hover:bg-teal/15 disabled:opacity-60"
            >
              {tag} ×
            </button>
          ))
        ) : (
          <p className="text-sm text-ink-muted">No tags yet.</p>
        )}
      </div>
      <form onSubmit={onSubmit} className="flex flex-wrap gap-2">
        <input
          className="min-w-[10rem] flex-1 rounded-lg border border-line px-3 py-2 text-sm"
          placeholder="Add a tag"
          value={draft}
          disabled={disabled}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button
          type="submit"
          disabled={disabled || !draft.trim()}
          className="rounded-lg border border-line px-3 py-2 text-sm font-semibold text-ink hover:border-teal/40 disabled:opacity-60"
        >
          Add
        </button>
        {onSave ? (
          <button
            type="button"
            disabled={disabled || pending}
            onClick={() => onSave(value)}
            className="rounded-lg bg-teal px-3 py-2 text-sm font-semibold text-white hover:bg-teal-dark disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save tags"}
          </button>
        ) : null}
      </form>
      {unused.length ? (
        <div className="flex flex-wrap gap-2">
          {unused.slice(0, 8).map((tag) => (
            <button
              key={tag.id}
              type="button"
              disabled={disabled}
              onClick={() => add(tag.name)}
              className="rounded-full bg-paper px-3 py-1 text-xs font-medium text-ink-muted hover:text-ink disabled:opacity-60"
            >
              + {tag.name}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
