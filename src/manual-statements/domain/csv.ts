import { createHash } from "crypto";
import { money } from "../../bookkeeping/domain/money";
import { aliasesFor, CsvFormatProfile, detectProfile, normalizeHeader } from "./profiles";

export interface ParsedStatementRow {
  line: number;
  date: string;
  amount: number;
  type: "CREDIT" | "DEBIT";
  description: string;
  balance: number | null;
  externalTransactionId: string;
  raw: Record<string, string>;
}

export interface StatementParseResult {
  profile: CsvFormatProfile;
  columns: Record<string, number>;
  rows: ParsedStatementRow[];
  skipped: Array<{ line: number; reason: string }>;
}

const MONTHS: Record<string, string> = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dec: "12",
};

export function rejectNonCsv(fileName: string, content: string): string | null {
  const name = fileName.trim().toLowerCase();
  const blocked = [".pdf", ".xlsx", ".xls", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".heic", ".ofx", ".qif", ".xml"];
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".")) : "";
  if (ext && ext !== ".csv") {
    return `Only .CSV bank statements are supported. Rejected ${ext || "unknown"} file.`;
  }
  if (!name.endsWith(".csv")) {
    return "Only .CSV bank statements are supported";
  }
  if (blocked.some((suffix) => name.endsWith(suffix))) {
    return "Only .CSV bank statements are supported";
  }
  const sniff = content.replace(/^\uFEFF/, "").slice(0, 8);
  if (sniff.startsWith("%PDF") || sniff.startsWith("PK") || sniff.includes("\u0000")) {
    return "File content is not a CSV statement";
  }
  return null;
}

export function detectDelimiter(header: string): "," | ";" {
  let commas = 0;
  let semicolons = 0;
  let quoted = false;
  for (const char of header) {
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (!quoted && char === ",") {
      commas += 1;
    }
    if (!quoted && char === ";") {
      semicolons += 1;
    }
  }
  return semicolons > commas ? ";" : ",";
}

export function splitCsvLine(row: string, delimiter: "," | ";" = ","): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < row.length; i += 1) {
    const char = row[i];
    if (char === '"') {
      if (quoted && row[i + 1] === '"') {
        current += '"';
        i += 1;
        continue;
      }
      quoted = !quoted;
      continue;
    }
    if (char === delimiter && !quoted) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

export function parseMoneyCell(raw: string | undefined): number | null {
  if (raw == null || !raw.trim()) {
    return null;
  }
  let value = raw.trim();
  const paren = /^\(.*\)$/.test(value);
  const cr = /\bcr\b/i.test(value);
  const dr = /\bdr\b/i.test(value);
  value = value.replace(/[£$€\s,]/g, "").replace(/[()]/g, "").replace(/(cr|dr)$/i, "");
  if (!value || value === "-" || value === "—") {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  if (paren || dr) {
    return money(-Math.abs(parsed));
  }
  if (cr) {
    return money(Math.abs(parsed));
  }
  return money(parsed);
}

export function parseUkDate(raw: string | undefined): string | null {
  if (!raw?.trim()) {
    return null;
  }
  const value = raw.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (iso) {
    return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }
  const named = /^(\d{1,2})[\/\-\s]([A-Za-z]{3,})[\/\-\s](\d{2,4})$/.exec(value);
  if (named) {
    const month = MONTHS[named[2].slice(0, 3).toLowerCase()];
    if (month) {
      return `${expandYear(named[3])}-${month}-${named[1].padStart(2, "0")}`;
    }
  }
  const uk = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/.exec(value);
  if (uk) {
    return `${expandYear(uk[3])}-${uk[2].padStart(2, "0")}-${uk[1].padStart(2, "0")}`;
  }
  return null;
}

export function cleanDescription(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/\b(?:\d{4}[ *]?){3}\d{4}\b/g, "")
    .replace(/[|]{2,}/g, " ")
    .trim();
}

export function transactionFingerprint(date: string, amount: number, description: string): string {
  const normalized = `${date}|${money(amount).toFixed(2)}|${cleanDescription(description).toLowerCase()}`;
  return createHash("sha256").update(normalized).digest("hex").slice(0, 32);
}

export function parseStatementCsv(text: string): StatementParseResult {
  const rows = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);
  if (rows.length < 2) {
    return {
      profile: detectProfile([]),
      columns: {},
      rows: [],
      skipped: [{ line: 1, reason: "CSV must include a header row and at least one transaction" }],
    };
  }

  const delimiter = detectDelimiter(rows[0]);
  const headerCells = splitCsvLine(rows[0], delimiter);
  const headers = headerCells.map(normalizeHeader);
  const profile = detectProfile(headers);
  const columns = resolveColumns(headers, profile);
  if (columns.date < 0 || (columns.amount < 0 && columns.debit < 0 && columns.credit < 0)) {
    return {
      profile,
      columns,
      rows: [],
      skipped: [{ line: 1, reason: "CSV must include a date column and an amount or debit/credit column" }],
    };
  }
  const parsed: ParsedStatementRow[] = [];
  const skipped: Array<{ line: number; reason: string }> = [];

  rows.slice(1).forEach((row, index) => {
    const line = index + 2;
    const cells = splitCsvLine(row, delimiter);
    const raw = Object.fromEntries(headerCells.map((header, idx) => [header, cells[idx] ?? ""]));
    const date = parseUkDate(cells[columns.date]);
    if (!date) {
      skipped.push({ line, reason: "Missing or invalid date" });
      return;
    }
    const description = cleanDescription(cells[columns.description] ?? "Imported");
    const typed = resolveTypeAndAmount(cells, columns);
    if (!typed) {
      skipped.push({ line, reason: "Missing or invalid amount" });
      return;
    }
    const balance = columns.balance >= 0 ? parseMoneyCell(cells[columns.balance]) : null;
    parsed.push({
      line,
      date,
      amount: typed.amount,
      type: typed.type,
      description: description || "Imported",
      balance,
      externalTransactionId: transactionFingerprint(date, typed.signed, description || "Imported"),
      raw,
    });
  });

  return { profile, columns, rows: parsed, skipped };
}

function resolveColumns(headers: string[], profile: CsvFormatProfile): Record<string, number> {
  const find = (role: Parameters<typeof aliasesFor>[0]) =>
    headers.findIndex((header) => aliasesFor(role, profile).includes(header));
  return {
    date: find("date"),
    description: find("description"),
    amount: find("amount"),
    debit: find("debit"),
    credit: find("credit"),
    balance: find("balance"),
    type: find("type"),
    reference: find("reference"),
  };
}

function resolveTypeAndAmount(
  cells: string[],
  columns: Record<string, number>,
): { amount: number; type: "CREDIT" | "DEBIT"; signed: number } | null {
  if (columns.debit >= 0 || columns.credit >= 0) {
    const debit = columns.debit >= 0 ? parseMoneyCell(cells[columns.debit]) : null;
    const credit = columns.credit >= 0 ? parseMoneyCell(cells[columns.credit]) : null;
    const hasDebit = debit != null && debit !== 0;
    const hasCredit = credit != null && credit !== 0;
    if (hasDebit && !hasCredit) {
      return { amount: money(Math.abs(debit)), type: "DEBIT", signed: -money(Math.abs(debit)) };
    }
    if (hasCredit && !hasDebit) {
      return { amount: money(Math.abs(credit)), type: "CREDIT", signed: money(Math.abs(credit)) };
    }
    if (!hasDebit && !hasCredit) {
      return null;
    }
  }

  if (columns.amount < 0) {
    return null;
  }
  const signed = parseMoneyCell(cells[columns.amount]);
  if (signed == null || signed === 0) {
    return null;
  }
  const rawType = (cells[columns.type] ?? "").toLowerCase();
  if (rawType.startsWith("cr") || rawType === "credit" || rawType === "in") {
    return { amount: money(Math.abs(signed)), type: "CREDIT", signed: money(Math.abs(signed)) };
  }
  if (rawType.startsWith("dr") || rawType === "debit" || rawType === "out") {
    return { amount: money(Math.abs(signed)), type: "DEBIT", signed: -money(Math.abs(signed)) };
  }
  return signed < 0
    ? { amount: money(Math.abs(signed)), type: "DEBIT", signed: -money(Math.abs(signed)) }
    : { amount: money(signed), type: "CREDIT", signed: money(signed) };
}

function expandYear(year: string): string {
  if (year.length === 4) {
    return year;
  }
  const parsed = Number(year);
  return parsed >= 70 ? `19${year.padStart(2, "0")}` : `20${year.padStart(2, "0")}`;
}
