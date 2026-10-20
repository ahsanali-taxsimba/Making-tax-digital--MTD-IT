export function confidencePercent(value?: number | null): number {
  return Math.round(Number(value ?? 0) * 100);
}

export function confidenceTone(value?: number | null): "high" | "medium" | "low" {
  const score = Number(value ?? 0);
  if (score >= 0.85) {
    return "high";
  }
  if (score >= 0.6) {
    return "medium";
  }
  return "low";
}

export function reasonLabel(reason?: string | null): string {
  const cleaned = String(reason ?? "")
    .replace(/:/g, " · ")
    .replace(/[_-]+/g, " ")
    .trim();
  if (!cleaned) {
    return "—";
  }
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export const BANK_WORKSPACE_TABS = [
  { href: "/reconciliation", label: "Reconciliation", match: "/reconciliation" },
  { href: "/categorisation", label: "Auto-categorisation", match: "/categorisation" },
  { href: "/matching", label: "Invoice & bill matching", match: "/matching" },
] as const;
