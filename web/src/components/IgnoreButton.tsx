"use client";

export function IgnoreButton({
  onClick,
  disabled,
  pending,
}: {
  onClick: () => void;
  disabled?: boolean;
  pending?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || pending}
      className="rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-ink hover:border-danger/40 hover:text-danger disabled:opacity-60"
    >
      {pending ? "Ignoring…" : "Ignore"}
    </button>
  );
}
