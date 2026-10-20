import { EnrichmentService } from "./enrichment.service";

describe("EnrichmentService", () => {
  const service = new EnrichmentService();

  it("cleans descriptions and infers merchant, MCC, VAT and ITSA hints", () => {
    const fuel = service.enrich({ description: "  BP  FUEL  CARD  ", type: "DEBIT" });
    expect(fuel.merchantName).toMatch(/BP/i);
    expect(fuel.merchantCategoryCode).toBe("5541");
    expect(fuel.category).toBe("motor_expenses");
    expect(fuel.itsaBucket).toBe("expense");

    const sale = service.enrich({ description: "INV-1001 Brighton Gallery Ltd", type: "CREDIT" });
    expect(sale.merchantName).toMatch(/Brighton Gallery/i);
    expect(sale.vatHint).toBe("STANDARD");
    expect(sale.itsaBucket).toBe("income");
  });
});
