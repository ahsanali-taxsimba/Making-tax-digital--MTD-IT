import {
  documentFrom,
  journalFrom,
  nodeStatus,
  statusTone,
  timelineNodes,
  transactionFrom,
  vatFrom,
} from "./digital-links";
import type { DigitalLinkNode, DigitalLinks } from "./audit";

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
  chain: "vat",
  resourceId: "doc-1",
  document: node({
    type: "document",
    id: "doc-1",
    label: "tesco-receipt.pdf",
    linked: true,
    detail: { fileName: "tesco-receipt.pdf", fileType: "pdf", ocrText: "TESCO", ocrAmount: 12.4, extractedData: { supplierName: "Tesco", grandTotal: 12.4, vatTotal: 2.07 } },
  }),
  bankTransaction: node({
    type: "bank_transaction",
    id: "txn-1",
    label: "TESCO STORES",
    linked: true,
    detail: { date: "2026-05-01", amount: 12.4, description: "TESCO STORES", category: "groceries", status: "MATCHED" },
  }),
  journalEntry: node({
    type: "journal",
    id: "j1",
    label: "J-100",
    linked: true,
    detail: {
      date: "2026-05-01",
      reference: "J-100",
      lines: [{ ledger: { name: "Purchases", code: 5000 }, debit: 10.33, credit: 0 }, { ledger: { name: "Bank" }, debit: 0, credit: 12.4 }],
    },
  }),
  extraction: node({ type: "extraction", id: "doc-1", label: "Invoice extraction", linked: true, detail: { data: { supplierName: "Tesco" } } }),
  invoice: node({ type: "invoice", id: null, label: "Invoice", linked: false, detail: null }),
  vatReturn: node({
    type: "vat_return",
    id: "vat-1",
    label: "26A1",
    linked: true,
    detail: { periodKey: "26A1", status: "SUBMITTED", hmrcSubmissionId: "FB-99", box1: 1200, box4: 200, box5: 1000 },
  }),
  quarterlyUpdate: node({ type: "itsa_submission", id: null, label: "Quarterly update", linked: false, detail: null }),
  eops: node({ type: "itsa_eops", id: null, label: "EOPS", linked: false, detail: null }),
  finalDeclaration: node({ type: "itsa_final", id: null, label: "Final declaration", linked: false, detail: null }),
  path: ["document", "bankTransaction", "journalEntry", "vatReturn"],
};

describe("digital link status", () => {
  it("marks a complete VAT chain as linked", () => {
    expect(nodeStatus("document", links.document, links.extraction)).toBe("linked");
    expect(nodeStatus("bank", links.bankTransaction)).toBe("linked");
    expect(nodeStatus("journal", links.journalEntry)).toBe("linked");
    expect(nodeStatus("vat", links.vatReturn)).toBe("linked");
    expect(statusTone("linked").label).toBe("Linked");
  });

  it("uses amber for unmatched bank lines and draft VAT", () => {
    expect(nodeStatus("bank", node({ type: "bank_transaction", id: "t1", linked: true, detail: { status: "UNMATCHED" } }))).toBe("partial");
    expect(nodeStatus("vat", node({ type: "vat_return", id: "v1", linked: true, detail: { status: "DRAFT" } }))).toBe("partial");
    expect(statusTone("partial").dot).toBe("bg-warning");
  });

  it("uses red when a node is absent", () => {
    expect(nodeStatus("journal", node({ type: "journal", id: null, linked: false, detail: null }))).toBe("missing");
    expect(statusTone("missing").dot).toBe("bg-danger");
  });
});

describe("timeline and detail mapping", () => {
  it("builds the four HMRC nodes in order", () => {
    expect(timelineNodes(links).map((item) => item.kind)).toEqual(["document", "bank", "journal", "vat"]);
    expect(timelineNodes(links)[0].subtitle).toBe("tesco-receipt.pdf");
  });

  it("reads OCR, bank, journal lines and VAT boxes", () => {
    const document = documentFrom(links.document);
    expect(document?.extracted?.supplier).toBe("Tesco");
    expect(document?.ocrText).toBe("TESCO");
    expect(transactionFrom(links.bankTransaction)?.amount).toBe(12.4);
    expect(journalFrom(links.journalEntry)?.lines).toHaveLength(2);
    expect(journalFrom(links.journalEntry)?.lines[0].account).toBe("Purchases");
    const vat = vatFrom(links.vatReturn);
    expect(vat?.hmrcSubmissionId).toBe("FB-99");
    expect(vat?.boxes[0].value).toBe(1200);
    expect(vat?.boxes[4].id).toBe("box5");
  });
});
