import { ChartProfile } from "@prisma/client";
import {
  boxesFromSources,
  finaliseVatBoxes,
  lookupVatMapping,
  VAT_BOX_MAPPING,
  VAT_LEDGER_ACCOUNTS,
} from "./vat-box.mapping";

describe("VAT box mapping", () => {
  it("covers HMRC boxes 1-9", () => {
    expect(Object.keys(VAT_BOX_MAPPING)).toEqual([
      "box_1",
      "box_2",
      "box_3",
      "box_4",
      "box_5",
      "box_6",
      "box_7",
      "box_8",
      "box_9",
    ]);
    expect(VAT_BOX_MAPPING.box_3.calculated).toBe(true);
    expect(VAT_BOX_MAPPING.box_5.calculated).toBe(true);
  });

  it("maps output VAT and net sales without double-counting aliases", () => {
    expect(lookupVatMapping(ChartProfile.SOLE_TRADER, 2200)?.boxes).toEqual(["box_1"]);
    expect(lookupVatMapping(ChartProfile.SOLE_TRADER, 1000)?.boxes).toEqual(["box_6"]);
    expect(boxesFromSources(5000, ["Sales", "Turnover"])).toEqual({ box_6: 5000 });
  });

  it("maps input VAT, purchases, and EU boxes", () => {
    expect(lookupVatMapping(ChartProfile.SOLE_TRADER, 2210)?.boxes).toEqual(["box_2"]);
    expect(lookupVatMapping(ChartProfile.SOLE_TRADER, 2220)?.boxes).toEqual(["box_4"]);
    expect(lookupVatMapping(ChartProfile.SOLE_TRADER, 2250)?.boxes).toEqual(["box_4"]);
    expect(lookupVatMapping(ChartProfile.SOLE_TRADER, 2000)?.boxes).toEqual(["box_7"]);
    expect(lookupVatMapping(ChartProfile.SOLE_TRADER, 5100)?.boxes).toEqual(["box_8"]);
    expect(lookupVatMapping(ChartProfile.SOLE_TRADER, 5110)?.boxes).toEqual(["box_9"]);
  });

  it("treats landlord rent as box 6 sales and property costs as box 7", () => {
    expect(lookupVatMapping(ChartProfile.LANDLORD, 2000)?.boxes).toEqual(["box_6"]);
    expect(lookupVatMapping(ChartProfile.LANDLORD, 3000)?.boxes).toEqual(["box_7"]);
  });

  it("calculates box 3 as 1+2 and box 5 as the absolute net", () => {
    const reclaim = finaliseVatBoxes({
      vatDueSales: 1200,
      vatDueAcquisitions: 80,
      vatReclaimedCurrPeriod: 200,
      totalValueSalesExVAT: 6000,
      totalValuePurchasesExVAT: 1000,
      totalValueGoodsSuppliedExVAT: 0,
      totalAcquisitionsExVAT: 400,
    });
    expect(reclaim.totalVatDue).toBe(1280);
    expect(reclaim.netVatDue).toBe(1080);

    const repayment = finaliseVatBoxes({
      vatDueSales: 100,
      vatDueAcquisitions: 0,
      vatReclaimedCurrPeriod: 400,
      totalValueSalesExVAT: 500,
      totalValuePurchasesExVAT: 2000,
      totalValueGoodsSuppliedExVAT: 0,
      totalAcquisitionsExVAT: 0,
    });
    expect(repayment.netVatDue).toBe(300);
  });

  it("publishes VAT control accounts for every chart", () => {
    expect(VAT_LEDGER_ACCOUNTS.map((account) => account.code)).toEqual(
      expect.arrayContaining([1060, 1070, 2200, 2210, 2220, 5100, 5110, 5120]),
    );
  });
});
