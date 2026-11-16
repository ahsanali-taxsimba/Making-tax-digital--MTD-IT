import { confidencePercent, confidenceTone } from "@/lib/bank-workspace";

export function ConfidenceBadge({ value }: { value?: number | null }) {
  const tone = confidenceTone(value);
  const percent = confidencePercent(value);
  const classes =
    tone === "high"
      ? "bg-success-soft text-success"
      : tone === "medium"
        ? "bg-paper text-ink"
        : "bg-danger-soft text-danger";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${classes}`}>{percent}% confidence</span>;
}
