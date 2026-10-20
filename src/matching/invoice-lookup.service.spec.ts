import { InvoiceLookupService } from "./invoice-lookup.service";

describe("InvoiceLookupService", () => {
  const repo = {
    listInvoices: jest.fn(),
    findInvoice: jest.fn(),
  };
  const service = new InvoiceLookupService(repo as never);

  const row = {
    id: "bbbbbbbb-0000-4000-8000-000000000001",
    date: new Date("2026-01-15"),
    status: "POSTED",
    grossTotal: 7200,
    journalId: "aaaaaaa1-0000-4000-8000-000000000001",
    customer: { name: "Brighton Gallery Ltd" },
    journal: { reference: "INV-1001", description: "Sales invoice INV-1001 Brighton Gallery Ltd" },
    lines: [{ description: "Studio sales" }],
  };

  it("maps a posted sales invoice to a matchable document", async () => {
    repo.listInvoices.mockResolvedValue([row]);
    const [document] = await service.list("client-1");
    expect(document).toMatchObject({
      id: row.id,
      kind: "invoice",
      reference: "INV-1001",
      partyName: "Brighton Gallery Ltd",
      description: "Studio sales",
      grossTotal: 7200,
      journalId: row.journalId,
    });
  });

  it("excludes invoices that already have an applied match", async () => {
    repo.listInvoices.mockResolvedValue([row]);
    await expect(service.list("client-1", [row.id])).resolves.toEqual([]);
  });
});
