export function parsePeriod(period?: string): { start: Date; end: Date } | null {
  if (!period?.trim()) {
    return null;
  }
  const trimmed = period.trim();
  const parts = trimmed.includes("/") ? trimmed.split("/") : trimmed.split(",");
  if (parts.length === 2 && parts[0] && parts[1]) {
    const start = new Date(parts[0]);
    const end = new Date(parts[1]);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
      return { start, end };
    }
  }
  const year = /^(\d{4})-(\d{2})$/.exec(trimmed);
  if (year) {
    const startYear = Number(year[1]);
    return { start: new Date(`${startYear}-04-06T00:00:00.000Z`), end: new Date(`${startYear + 1}-04-05T23:59:59.999Z`) };
  }
  const single = new Date(trimmed);
  if (!Number.isNaN(single.getTime())) {
    const end = new Date(single);
    end.setUTCFullYear(end.getUTCFullYear() + 1);
    return { start: single, end };
  }
  return null;
}
