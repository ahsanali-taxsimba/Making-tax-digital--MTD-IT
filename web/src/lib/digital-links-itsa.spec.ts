import type { DigitalLinkNode, DigitalLinks } from "./audit";
import { eopsFrom, filingStatus, finalFrom, itsaTimelineNodes, quarterlyFrom } from "./digital-links-itsa";

function node(partial: Partial<DigitalLinkNode> & Pick<DigitalLinkNode, "type">): DigitalLinkNode {
  return {
    id: null,
    label: partial.type,
    linked: false,
    detail: null,
    ...partial,
  };
}

const links: DigitalLinks = {
  chain: "itsa",
  resourceId: "doc-itsa",
  document: node({ type: "document", id: "doc-itsa", label: "uber-receipt.pdf", linked: true, detail: { ocrText: "UBER" } }),
  bankTransaction: node({
    type: "bank_transaction",
    id: "txn-itsa",
    label: "UBER TRIP",
    linked: true,
    detail: { status: "MATCHED", amount: 18.4, category: "travel" },
  }),
  journalEntry: node({
    type: "journal",
    id: "j-itsa",
    label: "J-ITSA",
    linked: true,
    detail: { lines: [{ ledger: { name: "Travel", code: 5100 }, debit: 18.4, credit: 0 }] },
  }),
  extraction: node({ type: "extraction", id: "doc-itsa", linked: true, detail: { data: { supplierName: "Uber" } } }),
  invoice: node({ type: "invoice" }),
  vatReturn: node({ type: "vat_return" }),
  quarterlyUpdate: node({
    type: "itsa_submission",
    id: "q1",
    label: "2025-26 Q1",
    linked: true,
    detail: {
      taxYear: "2025-26",
      periodId: "Q1",
      status: "SUBMITTED",
      hmrcSubmissionId: "ITSA-Q1",
      incomes: { turnover: 5000 },
      expenses: { officeCosts: 250 },
      adjustments: { privateUse: 40 },
    },
  }),
  eops: node({
    type: "itsa_eops",
    id: "eops-1",
    label: "EOPS 2025-26",
    linked: true,
    detail: { taxYear: "2025-26", status: "SUBMITTED", hmrcSubmissionId: "EOPS-99", typeOfBusiness: "self-employment" },
  }),
  finalDeclaration: node({
    type: "itsa_final",
    id: "final-1",
    label: "Final 2025-26",
    linked: true,
    detail: { taxYear: "2025-26", status: "SUBMITTED", hmrcSubmissionId: "FD-1", calculation: { incomeTax: 2100 } },
  }),
  path: ["document", "bankTransaction", "journalEntry", "quarterlyUpdate", "eops", "finalDeclaration"],
};

describe("ITSA digital-link timeline", () => {
  it("builds the six HMRC nodes in order", () => {
    expect(itsaTimelineNodes(links).map((item) => item.kind)).toEqual([
      "document",
      "bank",
      "journal",
      "quarterly",
      "eops",
      "final",
    ]);
  });

  it("reads quarterly incomes, expenses, adjustments and HMRC id", () => {
    const quarterly = quarterlyFrom(links.quarterlyUpdate);
    expect(quarterly?.incomes[0]).toMatchObject({ id: "turnover", value: 5000 });
    expect(quarterly?.expenses[0].id).toBe("officeCosts");
    expect(quarterly?.adjustments[0]).toMatchObject({ id: "privateUse", value: 40 });
    expect(quarterly?.hmrcSubmissionId).toBe("ITSA-Q1");
    expect(filingStatus(links.quarterlyUpdate)).toBe("linked");
  });

  it("marks draft filings as partial and missing nodes as red", () => {
    expect(filingStatus(node({ type: "itsa_eops", id: "e1", linked: true, detail: { status: "DRAFT" } }))).toBe("partial");
    expect(filingStatus(node({ type: "itsa_final", id: null, linked: false }))).toBe("missing");
    expect(eopsFrom(links.eops)?.hmrcSubmissionId).toBe("EOPS-99");
    expect(finalFrom(links.finalDeclaration)?.calculation.incomeTax).toBe(2100);
  });
});
