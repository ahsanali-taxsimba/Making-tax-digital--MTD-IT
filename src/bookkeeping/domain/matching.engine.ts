import { daysBetween, money, toIsoDate } from "./money";

export interface MatchableBankTxn {
  id: string;
  date: Date | string;
  amount: number;
  type: "CREDIT" | "DEBIT";
  description: string;
  status: string;
}

export interface MatchableJournal {
  id: string;
  date: Date | string;
  description: string;
  reference?: string | null;
  total: number;
}

export interface MatchSuggestion {
  bankTransactionId: string;
  journalEntryId: string;
  score: number;
  reasons: string[];
}

export function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter((token) => token.length > 2);
}

export function descriptionScore(left: string, right: string): number {
  const a = new Set(tokenize(left));
  const b = new Set(tokenize(right));
  if (a.size === 0 || b.size === 0) {
    return 0;
  }
  let overlap = 0;
  for (const token of a) {
    if (b.has(token)) {
      overlap += 1;
    }
  }
  return overlap / Math.max(a.size, b.size);
}

export function suggestMatches(
  transactions: MatchableBankTxn[],
  journals: MatchableJournal[],
  windowDays = 3,
): MatchSuggestion[] {
  const suggestions: MatchSuggestion[] = [];
  for (const txn of transactions) {
    if (txn.status !== "UNMATCHED") {
      continue;
    }
    for (const journal of journals) {
      if (money(txn.amount) !== money(journal.total)) {
        continue;
      }
      const gap = daysBetween(txn.date, journal.date);
      if (gap > windowDays) {
        continue;
      }
      const text = `${journal.description} ${journal.reference ?? ""}`;
      const overlap = descriptionScore(txn.description, text);
      const score = money(70 + Math.max(0, (windowDays - gap) * 5) + overlap * 20);
      const reasons = ["amount"];
      if (gap === 0) {
        reasons.push("same_date");
      } else {
        reasons.push(`date_within_${gap}d`);
      }
      if (overlap > 0) {
        reasons.push("description");
      }
      suggestions.push({
        bankTransactionId: txn.id,
        journalEntryId: journal.id,
        score,
        reasons,
      });
    }
  }
  return suggestions.sort((left, right) => right.score - left.score);
}

export interface ImportedBankLine {
  date: string;
  amount: number;
  type: "CREDIT" | "DEBIT";
  description: string;
  externalRef?: string;
}

export function parseBankCsv(text: string): ImportedBankLine[] {
  const rows = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (rows.length === 0) {
    return [];
  }
  const header = rows[0].split(",").map((cell) => cell.trim().toLowerCase().replace(/[^a-z]/g, ""));
  const dateIdx = header.findIndex((cell) => cell === "date");
  const amountIdx = header.findIndex((cell) => cell === "amount");
  const typeIdx = header.findIndex((cell) => cell === "type" || cell === "direction");
  const descIdx = header.findIndex((cell) => cell === "description" || cell === "narrative" || cell === "memo");
  const refIdx = header.findIndex((cell) => cell === "externalref" || cell === "reference" || cell === "ref");
  if (dateIdx < 0 || amountIdx < 0) {
    throw new Error("CSV must include date and amount columns");
  }
  return rows.slice(1).map((row) => {
    const cells = splitCsv(row);
    const amount = money(Math.abs(Number(cells[amountIdx])));
    const rawType = (cells[typeIdx] ?? "").toLowerCase();
    const signed = Number(cells[amountIdx]);
    const type: "CREDIT" | "DEBIT" =
      rawType.startsWith("cr") || rawType === "credit"
        ? "CREDIT"
        : rawType.startsWith("dr") || rawType === "debit"
          ? "DEBIT"
          : signed < 0
            ? "DEBIT"
            : "CREDIT";
    return {
      date: toIsoDate(cells[dateIdx]),
      amount,
      type,
      description: cells[descIdx] ?? "Imported",
      externalRef: refIdx >= 0 ? cells[refIdx] : undefined,
    };
  });
}

export function parseBankOfx(text: string): ImportedBankLine[] {
  const blocks = text.split(/<STMTTRN>/i).slice(1);
  return blocks.map((block) => {
    const typeRaw = tag(block, "TRNTYPE").toUpperCase();
    const amount = money(Math.abs(Number(tag(block, "TRNAMT"))));
    const signed = Number(tag(block, "TRNAMT"));
    return {
      date: ofxDate(tag(block, "DTPOSTED")),
      amount,
      type: typeRaw.includes("DEBIT") || signed < 0 ? "DEBIT" : "CREDIT",
      description: tag(block, "NAME") || tag(block, "MEMO") || "OFX import",
      externalRef: tag(block, "FITID") || undefined,
    };
  });
}

function tag(block: string, name: string): string {
  const match = new RegExp(`<${name}>([^<\\n\\r]+)`, "i").exec(block);
  return match ? match[1].trim() : "";
}

function ofxDate(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length === 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  }
  return toIsoDate(new Date());
}

function splitCsv(row: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (const char of row) {
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}
