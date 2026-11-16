export function LoadingSpinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-sm text-ink-muted" role="status" aria-live="polite">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-teal/20 border-t-teal" />
      <span>{label}</span>
    </div>
  );
}
