import { money } from "../../bookkeeping/domain/money";
import { ParsedStatementRow, StatementParseResult } from "./csv";

export interface CsvHealthIssue {
  code: "MISSING_DATE" | "INVALID_AMOUNT" | "DUPLICATE_ROW" | "BALANCE_INCONSISTENCY" | "EMPTY_FILE";
  message: string;
  line?: number;
}

export interface CsvHealthReport {
  ok: boolean;
  profile: string;
  rowCount: number;
  validCount: number;
  skippedCount: number;
  duplicateCount: number;
  issues: CsvHealthIssue[];
}

export function healthCheckStatement(parsed: StatementParseResult): CsvHealthReport {
  const issues: CsvHealthIssue[] = parsed.skipped.map((row) => ({
    code: row.reason.toLowerCase().includes("date") ? "MISSING_DATE" : "INVALID_AMOUNT",
    message: row.reason,
    line: row.line,
  }));

  const seen = new Map<string, number>();
  let duplicateCount = 0;
  for (const row of parsed.rows) {
    const previous = seen.get(row.externalTransactionId);
    if (previous) {
      duplicateCount += 1;
      issues.push({
        code: "DUPLICATE_ROW",
        message: `Duplicate of line ${previous} (${row.date} ${row.description})`,
        line: row.line,
      });
    } else {
      seen.set(row.externalTransactionId, row.line);
    }
  }

  issues.push(...balanceIssues(parsed.rows));

  if (parsed.rows.length === 0) {
    issues.push({ code: "EMPTY_FILE", message: "No valid transaction rows were found" });
  }

  return {
    ok: issues.filter((issue) => issue.code !== "DUPLICATE_ROW").length === 0,
    profile: parsed.profile.id,
    rowCount: parsed.rows.length + parsed.skipped.length,
    validCount: parsed.rows.length,
    skippedCount: parsed.skipped.length,
    duplicateCount,
    issues,
  };
}

function balanceIssues(rows: ParsedStatementRow[]): CsvHealthIssue[] {
  const withBalance = rows.filter((row) => row.balance != null);
  if (withBalance.length < 2) {
    return [];
  }
  const oldestFirst = scoreDirection(withBalance, 1);
  const newestFirst = scoreDirection(withBalance, -1);
  const direction = newestFirst.matches >= oldestFirst.matches ? -1 : 1;
  const chosen = direction === -1 ? newestFirst : oldestFirst;
  if (chosen.matches / Math.max(withBalance.length - 1, 1) < 0.5) {
    return [];
  }
  return chosen.issues;
}

function scoreDirection(rows: ParsedStatementRow[], direction: 1 | -1) {
  const ordered = direction === 1 ? rows : [...rows].reverse();
  const issues: CsvHealthIssue[] = [];
  let matches = 0;
  for (let i = 1; i < ordered.length; i += 1) {
    const previous = ordered[i - 1];
    const current = ordered[i];
    const delta = current.type === "CREDIT" ? current.amount : -current.amount;
    const expected = money(Number(previous.balance) + delta);
    if (Math.abs(expected - Number(current.balance)) <= 0.01) {
      matches += 1;
    } else {
      issues.push({
        code: "BALANCE_INCONSISTENCY",
        message: `Balance ${current.balance} on ${current.date} does not follow ${previous.balance} ${delta >= 0 ? "+" : ""}${delta.toFixed(2)}`,
        line: current.line,
      });
    }
  }
  return { matches, issues };
}
