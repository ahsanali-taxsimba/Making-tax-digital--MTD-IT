export function SuccessBanner({ title = "Connected", message }: { title?: string; message: string }) {
  return (
    <div
      role="status"
      className="rounded-xl border border-success/20 bg-success-soft px-4 py-3 text-sm text-success"
    >
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-success/90">{message}</p>
    </div>
  );
}
