"use client";

export function MatchButton({
  onClick,
  disabled,
  pending,
  label = "Match",
}: {
  onClick: () => void;
  disabled?: boolean;
  pending?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || pending}
      className="rounded-lg bg-teal px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-dark disabled:opacity-60"
    >
      {pending ? "Matching…" : label}
    </button>
  );
}
