import { BK_ERR, BookkeepingError } from "../bookkeeping.errors";
import { LedgerSnapshot } from "./journal.rules";
import { assertTaxCompatible, vatOnNet } from "./tax.rules";

describe("tax rules", () => {
  const standard = { id: "s", code: "S", name: "Standard", rate: 20, type: "VAT_STANDARD" };
  const exempt = { id: "e", code: "E", name: "Exempt", rate: 0, type: "VAT_EXEMPT" };
  const sales: LedgerSnapshot = {
    id: "1000",
    clientId: "c",
    isActive: true,
    type: "INCOME",
    code: 1000,
    name: "Sales",
    profile: "SOLE_TRADER",
    category: "Income",
  };
  const exemptSales: LedgerSnapshot = { ...sales, id: "1070", code: 1070, name: "Exempt Sales" };

  it("calculates 20% VAT on a standard-rated net", () => {
    expect(vatOnNet(6000, standard)).toBe(1200);
    expect(vatOnNet(1000, exempt)).toBe(0);
  });

  it("rejects a standard code with the wrong rate", () => {
    try {
      assertTaxCompatible(sales, { ...standard, rate: 17.5 });
      fail("expected error");
    } catch (error) {
      expect((error as BookkeepingError).code).toBe(BK_ERR.INVALID_TAX_CODE);
    }
  });

  it("rejects VAT on an exempt account", () => {
    try {
      assertTaxCompatible(exemptSales, standard);
      fail("expected error");
    } catch (error) {
      expect((error as BookkeepingError).code).toBe(BK_ERR.INVALID_TAX_CODE);
    }
  });
});
