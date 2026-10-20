import { ChartProfile } from "@prisma/client";
import { applyAmountToVatBoxes, emptyVatBoxInput, finaliseVatBoxes, lookupVatMapping } from "../../vat/vat-box.mapping";
import { classifyAccount, LedgerSnapshot } from "./journal.rules";
import { money } from "./money";
import { TaxCodeSnapshot, vatOnNet } from "./tax.rules";

export interface VatJournalLine {
  ledger: LedgerSnapshot;
  debit: number;
  credit: number;
  tax?: TaxCodeSnapshot | null;
}

const VAT_CONTROL_CODES = new Set([2200, 2210, 2220, 2230, 2240, 2250, 2260, 4400]);

export function vatSummaryFromJournals(lines: VatJournalLine[]) {
  const input = emptyVatBoxInput();
  const detail: Array<{ code: number; name: string; net: number; vat: number; boxes: string[] }> = [];
  const hasTaxCodedTrading = lines.some((line) => {
    if (!line.tax) {
      return false;
    }
    const kind = classifyAccount(line.ledger);
    return kind === "income" || kind === "expense";
  });

  for (const line of lines) {
    const classification = classifyAccount(line.ledger);
    const net =
      classification === "income" || classification === "liability"
        ? money(Number(line.credit) - Number(line.debit))
        : money(Number(line.debit) - Number(line.credit));
    if (net === 0) {
      continue;
    }

    if (line.tax && (classification === "income" || classification === "expense")) {
      const vat = money(vatOnNet(Math.abs(net), line.tax) * Math.sign(net || 1));
      if (classification === "income") {
        input.totalValueSalesExVAT = money(input.totalValueSalesExVAT + net);
        if (line.tax.type !== "VAT_EXEMPT" && line.tax.type !== "NO_VAT") {
          input.vatDueSales = money(input.vatDueSales + vat);
        }
        detail.push({ code: line.ledger.code, name: line.ledger.name, net, vat, boxes: ["box_6", "box_1"] });
      } else {
        input.totalValuePurchasesExVAT = money(input.totalValuePurchasesExVAT + net);
        if (line.tax.type !== "VAT_EXEMPT" && line.tax.type !== "NO_VAT") {
          input.vatReclaimedCurrPeriod = money(input.vatReclaimedCurrPeriod + vat);
        }
        detail.push({ code: line.ledger.code, name: line.ledger.name, net, vat, boxes: ["box_7", "box_4"] });
      }
      continue;
    }

    if (hasTaxCodedTrading && VAT_CONTROL_CODES.has(line.ledger.code)) {
      continue;
    }

    const mapping = lookupVatMapping(line.ledger.profile as ChartProfile, line.ledger.code);
    if (!mapping) {
      continue;
    }
    applyAmountToVatBoxes(input, net, mapping.boxes);
    detail.push({ code: line.ledger.code, name: line.ledger.name, net, vat: 0, boxes: mapping.boxes });
  }

  const totals = finaliseVatBoxes(input);
  return {
    totals,
    lines: detail,
    boxes: {
      box1: totals.vatDueSales,
      box4: totals.vatReclaimedCurrPeriod,
      box6: totals.totalValueSalesExVAT,
      box7: totals.totalValuePurchasesExVAT,
    },
  };
}
