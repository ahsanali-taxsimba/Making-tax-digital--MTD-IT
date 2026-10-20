export function StatusCard({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "ok" | "action" | "neutral";
}) {
  const badge =
    tone === "ok" ? "bg-success-soft text-success" : tone === "action" ? "bg-amber-50 text-amber-800" : "bg-paper text-ink-muted";
  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">{label}</p>
      <p className="mt-2 text-xl font-semibold text-ink">{value}</p>
      {hint ? (
        <p className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold uppercase ${badge}`}>{hint}</p>
      ) : null}
    </section>
  );
}
