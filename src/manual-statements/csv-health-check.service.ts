import { Injectable } from "@nestjs/common";
import { parseStatementCsv, rejectNonCsv } from "./domain/csv";
import { CsvHealthReport, healthCheckStatement } from "./domain/health";
import { MANUAL_ERR, ManualStatementError } from "./manual-statements.errors";

@Injectable()
export class CsvHealthCheckService {
  inspect(fileName: string, content: string): CsvHealthReport & { preview: Array<Record<string, unknown>> } {
    const rejected = rejectNonCsv(fileName, content);
    if (rejected) {
      throw new ManualStatementError(MANUAL_ERR.FILE_TYPE, rejected);
    }
    const parsed = parseStatementCsv(content);
    const health = healthCheckStatement(parsed);
    return {
      ...health,
      preview: parsed.rows.slice(0, 10).map((row) => ({
        line: row.line,
        date: row.date,
        amount: row.amount,
        type: row.type,
        description: row.description,
        balance: row.balance,
        externalTransactionId: row.externalTransactionId,
      })),
    };
  }
}
