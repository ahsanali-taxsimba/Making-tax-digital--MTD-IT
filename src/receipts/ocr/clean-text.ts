const NOISE = [
  /\bwww\.[^\s]+/gi,
  /\bhttps?:\/\/[^\s]+/gi,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
  /\b(?:tel|phone|vat\s*reg(?:istration)?(?:\s*no\.?)?)\s*[:.]?\s*[A-Z0-9 ]{0,20}/gi,
];

export function cleanOcrText(text: string): string {
  let value = String(text ?? "")
    .replace(/\u0000/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t\f]+/g, " ")
    .replace(/\n{3,}/g, "\n\n");
  for (const pattern of NOISE) {
    value = value.replace(pattern, " ");
  }
  return value
    .split("\n")
    .map((line) => line.replace(/[|]+/g, " ").replace(/\s{2,}/g, " ").trim())
    .filter((line) => line && !/^[\W_]+$/.test(line))
    .join("\n")
    .trim();
}

export function ocrLines(text: string): string[] {
  return cleanOcrText(text)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function parseSterling(raw?: string | null): number | null {
  if (!raw) {
    return null;
  }
  const parsed = Number(String(raw).replace(/,/g, "").replace(/[£gbp\s]/gi, ""));
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Math.round(parsed * 100) / 100;
}

export function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function tokenOverlap(left: string, right: string): number {
  const a = new Set(normalizeKey(left).split(" ").filter((part) => part.length > 1));
  const b = new Set(normalizeKey(right).split(" ").filter((part) => part.length > 1));
  if (!a.size || !b.size) {
    return 0;
  }
  let shared = 0;
  for (const token of a) {
    if (b.has(token)) {
      shared += 1;
    }
  }
  return shared / Math.max(a.size, b.size);
}

export function levenshteinRatio(left: string, right: string): number {
  const a = normalizeKey(left);
  const b = normalizeKey(right);
  if (!a || !b) {
    return 0;
  }
  if (a === b) {
    return 1;
  }
  const rows = a.length + 1;
  const cols = b.length + 1;
  const grid = Array.from({ length: rows }, (_, i) => {
    const row = new Array<number>(cols);
    row[0] = i;
    return row;
  });
  for (let j = 0; j < cols; j += 1) {
    grid[0][j] = j;
  }
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      grid[i][j] = Math.min(grid[i - 1][j] + 1, grid[i][j - 1] + 1, grid[i - 1][j - 1] + cost);
    }
  }
  return 1 - grid[a.length][b.length] / Math.max(a.length, b.length);
}
