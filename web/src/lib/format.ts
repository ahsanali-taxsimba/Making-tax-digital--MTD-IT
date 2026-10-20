export function formatDate(value?: string | null): string {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

export function formatCountdown(expiresAt?: string | null, now = Date.now()): string {
  if (!expiresAt) {
    return "No expiry recorded";
  }
  const ms = new Date(expiresAt).getTime() - now;
  if (Number.isNaN(ms)) {
    return "No expiry recorded";
  }
  if (ms <= 0) {
    return "Expired";
  }
  const totalMinutes = Math.floor(ms / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) {
    return `${days}d ${hours}h remaining`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m remaining`;
  }
  const seconds = Math.floor((ms % 60_000) / 1000);
  return `${minutes}m ${seconds}s remaining`;
}

export function environmentLabel(value?: string | null): "sandbox" | "live" {
  return String(value ?? "sandbox").toLowerCase() === "live" ? "live" : "sandbox";
}

export function obligationStatus(value?: string | null): "open" | "fulfilled" {
  const normalised = String(value ?? "").toUpperCase();
  return normalised === "FULFILLED" || normalised === "F" ? "fulfilled" : "open";
}

export function businessTypeLabel(value?: string | null): string {
  const normalised = String(value ?? "").toLowerCase().replace(/[_-]+/g, " ");
  if (normalised.includes("property") || normalised.includes("landlord")) {
    return "Property";
  }
  if (normalised.includes("self") || normalised.includes("sole")) {
    return "Sole trade";
  }
  return value ? value.replace(/[_-]+/g, " ") : "Unassigned";
}

export function obligationTypeLabel(value?: string | null): string {
  switch (String(value ?? "").toUpperCase()) {
    case "EOPS":
      return "EOPS";
    case "FINAL_DECLARATION":
      return "Final declaration";
    default:
      return "Quarterly update";
  }
}

export function formatMoney(value?: number | null): string {
  if (value === undefined || value === null || Number.isNaN(Number(value))) {
    return "—";
  }
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(Number(value));
}
