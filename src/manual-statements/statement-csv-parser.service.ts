import { Injectable } from "@nestjs/common";
import { parseStatementCsv, rejectNonCsv, StatementParseResult } from "./domain/csv";
import { CSV_FORMAT_PROFILES } from "./domain/profiles";
import { MANUAL_ERR, ManualStatementError } from "./manual-statements.errors";

@Injectable()
export class StatementCSVParserService {
  profiles() {
    return CSV_FORMAT_PROFILES.map((profile) => ({
      id: profile.id,
      name: profile.name,
      bank: profile.bank,
      notes: profile.notes,
    }));
  }

  assertCsv(fileName: string, content: string) {
    const reason = rejectNonCsv(fileName, content);
    if (reason) {
      throw new ManualStatementError(MANUAL_ERR.FILE_TYPE, reason);
    }
    if (!content.trim()) {
      throw new ManualStatementError(MANUAL_ERR.EMPTY_FILE, "CSV file is empty");
    }
  }

  parse(fileName: string, content: string): StatementParseResult {
    this.assertCsv(fileName, content);
    const parsed = parseStatementCsv(content);
    if (parsed.rows.length === 0) {
      throw new ManualStatementError(MANUAL_ERR.PARSE_FAILED, parsed.skipped[0]?.reason ?? "CSV could not be parsed", {
        skipped: parsed.skipped,
        profile: parsed.profile.id,
      });
    }
    return parsed;
  }
}
