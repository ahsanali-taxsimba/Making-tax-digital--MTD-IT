export function ErrorBanner({ title = "Something went wrong", message }: { title?: string; message: string }) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-danger/20 bg-danger-soft px-4 py-3 text-sm text-danger"
    >
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-danger/90">{message}</p>
    </div>
  );
}
