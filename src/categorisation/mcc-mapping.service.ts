import { Injectable } from "@nestjs/common";
import { CategorisationRepository } from "./categorisation.repository";
import { MCC_MAPPING, isExemptMcc, isVatableMcc, matchMcc } from "./domain/mcc.mapping";
import { MccRule } from "./domain/types";

@Injectable()
export class MCCMappingService {
  constructor(private readonly repo: CategorisationRepository) {}

  async list(): Promise<MccRule[]> {
    const rows = await this.repo.listMccRules();
    if (rows.length === 0) {
      return MCC_MAPPING;
    }
    return rows.map((row) => ({
      mcc: row.mcc,
      industry: row.industry,
      categoryKey: row.categoryKey as MccRule["categoryKey"],
      ledgerCode: row.ledgerCode,
      taxCodeKind: row.taxCodeKind,
      vatable: row.vatable,
      itsaCategory: row.itsaCategory,
      confidence: Number(row.confidence),
    }));
  }

  async lookup(mcc: string | null | undefined): Promise<MccRule | null> {
    return matchMcc(mcc, await this.list());
  }

  catalog() {
    return MCC_MAPPING;
  }

  isVatable(mcc: string | null | undefined) {
    return isVatableMcc(mcc);
  }

  isExempt(mcc: string | null | undefined) {
    return isExemptMcc(mcc);
  }
}
