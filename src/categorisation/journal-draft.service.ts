import { Injectable } from "@nestjs/common";
import { ChartProfile, TaxCodeKind } from "@prisma/client";
import { LedgerSnapshot, TaxCodeSnapshot } from "../bookkeeping/domain/journal.rules";
import { buildDraftJournal, resolveBankAndVat, splitGross } from "./domain/journal-draft";
import { ClassifyInput, SuggestedJournal } from "./domain/types";

@Injectable()
export class JournalDraftService {
  build(input: {
    txn: ClassifyInput;
    counterpart: LedgerSnapshot;
    ledgers: LedgerSnapshot[];
    profile: ChartProfile;
    tax: TaxCodeSnapshot | null;
    taxCodeKind: TaxCodeKind;
  }): SuggestedJournal {
    const controls = resolveBankAndVat(input.ledgers, input.profile);
    return buildDraftJournal({
      txn: input.txn,
      counterpart: input.counterpart,
      bank: controls.bank,
      tax: input.tax,
      taxCodeKind: input.taxCodeKind,
      outputVat: controls.outputVat ?? undefined,
      inputVat: controls.inputVat ?? undefined,
    });
  }

  splitGross(gross: number, rate: number) {
    return splitGross(gross, rate);
  }
}
