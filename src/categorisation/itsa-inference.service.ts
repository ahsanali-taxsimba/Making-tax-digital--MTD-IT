import { Injectable } from "@nestjs/common";
import { ChartProfile } from "@prisma/client";
import { lookupItsaMapping } from "../itsa/mtd-itsa.mapping";

@Injectable()
export class ITSAInferenceService {
  infer(profile: ChartProfile, ledgerCode: number) {
    const mapping = lookupItsaMapping(profile, ledgerCode);
    if (!mapping) {
      return null;
    }
    return {
      category: mapping.category,
      bucket: mapping.bucket,
      hmrcKey: mapping.hmrcKey,
      includedInQuarterlyUpdate: mapping.includedInQuarterlyUpdate,
    };
  }
}
