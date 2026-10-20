export function money(value: number): number {
  return Number((Math.round((Number(value) + Number.EPSILON) * 100) / 100).toFixed(2));
}

export function sumMoney(values: number[]): number {
  return money(values.reduce((total, value) => total + Number(value || 0), 0));
}

export function toIsoDate(value: Date | string): string {
  if (typeof value === "string") {
    return value.slice(0, 10);
  }
  return value.toISOString().slice(0, 10);
}

export function parseDate(value: string | Date): Date {
  if (value instanceof Date) {
    return value;
  }
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}

export function inRange(date: Date | string, start: Date | string, end: Date | string): boolean {
  const current = toIsoDate(date);
  return current >= toIsoDate(start) && current <= toIsoDate(end);
}

export function financialYearBounds(taxYear: string): { start: string; end: string } {
  const match = /^(\d{4})-(\d{2})$/.exec(taxYear.trim());
  if (!match) {
    throw new Error(`Invalid financial year ${taxYear}`);
  }
  const startYear = Number(match[1]);
  return { start: `${startYear}-04-06`, end: `${startYear + 1}-04-05` };
}

export function daysBetween(left: Date | string, right: Date | string): number {
  const a = Date.parse(`${toIsoDate(left)}T00:00:00.000Z`);
  const b = Date.parse(`${toIsoDate(right)}T00:00:00.000Z`);
  return Math.abs(Math.round((a - b) / 86_400_000));
}
