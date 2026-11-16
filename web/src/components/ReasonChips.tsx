import { reasonLabel } from "@/lib/bank-workspace";

export function ReasonChips({ reasons }: { reasons?: string[] }) {
  if (!reasons?.length) {
    return null;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {reasons.map((reason) => (
        <span key={reason} className="rounded-full bg-paper px-2 py-0.5 text-xs text-ink-muted">
          {reasonLabel(reason)}
        </span>
      ))}
    </div>
  );
}
