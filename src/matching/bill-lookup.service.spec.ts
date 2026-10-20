import { BillLookupService } from "./bill-lookup.service";

describe("BillLookupService", () => {
  const repo = {
    listBills: jest.fn(),
    findBill: jest.fn(),
  };
  const service = new BillLookupService(repo as never);

  it("maps a posted purchase bill to a matchable document", async () => {
    repo.listBills.mockResolvedValue([
      {
        id: "bbbbbbbb-0000-4000-8000-000000000002",
        date: new Date("2026-02-10"),
        status: "POSTED",
        grossTotal: 1200,
        journalId: "aaaaaaa1-0000-4000-8000-000000000002",
        supplier: { name: "North Ads Agency" },
        journal: { reference: "BILL-88", description: "Purchase bill BILL-88 North Ads Agency" },
        lines: [{ description: "Advertising" }],
      },
    ]);
    const [document] = await service.list("client-1");
    expect(document).toMatchObject({
      kind: "bill",
      reference: "BILL-88",
      partyName: "North Ads Agency",
      grossTotal: 1200,
    });
  });
});
