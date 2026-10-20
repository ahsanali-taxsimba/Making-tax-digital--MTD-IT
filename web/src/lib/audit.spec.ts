import {
  AUDIT_RESOURCE_TYPES,
  actorLabel,
  auditActionLabel,
  auditExportCsv,
  auditSummary,
  diffRecords,
  digitalLinkResourceId,
  exportPeriod,
  flattenRecord,
  hmrcContext,
  linkedEntities,
  resourceTypeLabel,
  type AuditLogEntry,
  type DigitalLinks,
} from "./audit";

function entry(partial: Partial<AuditLogEntry> = {}): AuditLogEntry {
  return {
    id: "a1",
    firmId: "firm-a",
    clientId: "client-1",
    userId: "u1",
    action: "bookkeeping.invoice.posted",
    resourceType: "invoice",
    resourceId: "inv-1",
    beforeData: { status: "DRAFT", grossTotal: "1000" },
    afterData: { status: "POSTED", grossTotal: "1200" },
    metadata: { invoiceId: "inv-1", documentId: "doc-1" },
    createdAt: "2026-05-12T09:30:00.000Z",
    actor: { id: "u1", name: "James Cole", email: "j", role: "ACCOUNTANT" },
    client: { id: "client-1", name: "Amelia Hartley" },
    ...partial,
  };
}

const links: DigitalLinks = {
  chain: "invoice",
  resourceId: "inv-1",
  document: { type: "document", id: "doc-1", label: "invoice.pdf", linked: true, detail: null },
  bankTransaction: { type: "bank_transaction", id: null, label: "Bank transaction", linked: false, detail: null },
  journalEntry: { type: "journal", id: "j1", label: "J-100", linked: true, detail: null },
  extraction: { type: "extraction", id: "doc-1", label: "Invoice extraction", linked: true, detail: null },
  invoice: { type: "invoice", id: "inv-1", label: "INV-88", linked: true, detail: null },
  vatReturn: {
    type: "vat_return",
    id: "vat-1",
    label: "26A1",
    linked: true,
    detail: { periodKey: "26A1", status: "SUBMITTED", hmrcSubmissionId: "FB-99" },
  },
  quarterlyUpdate: { type: "itsa_submission", id: null, label: "Quarterly update", linked: false, detail: null },
  eops: { type: "itsa_eops", id: null, label: "EOPS", linked: false, detail: null },
  finalDeclaration: { type: "itsa_final", id: null, label: "Final declaration", linked: false, detail: null },
  path: ["document", "extraction", "invoice", "vatReturn"],
};

describe("audit labels", () => {
  it("covers the HMRC resource types used in the filter", () => {
    expect(AUDIT_RESOURCE_TYPES).toEqual(["bank_transaction", "invoice", "bill", "vat_return", "itsa_submission", "document"]);
    expect(resourceTypeLabel("vat_return")).toBe("VAT return");
    expect(auditActionLabel("vat.return.submitted")).toBe("VAT submitted");
    expect(auditActionLabel("matching.suggested")).toBe("Suggested");
  });

  it("summarises money and status changes", () => {
    expect(auditSummary(entry())).toBe("Invoice total changed from 1000 to 1200");
    expect(auditSummary(entry({ beforeData: { status: "DRAFT" }, afterData: { status: "POSTED" } }))).toBe(
      "Invoice status changed from DRAFT to POSTED",
    );
    expect(
      auditSummary(
        entry({
          action: "vat.return.submitted",
          resourceType: "vat_return",
          beforeData: null,
          afterData: { status: "SUBMITTED", periodKey: "26A1" },
          metadata: { periodKey: "26A1" },
        }),
      ),
    ).toBe("Submitted vat return 26A1");
    expect(actorLabel(entry())).toContain("James Cole");
    expect(
      auditSummary(entry({ action: "document.attached", resourceType: "document", beforeData: null, afterData: null })),
    ).toBe("Document attached to invoice");
  });
});

describe("json diff", () => {
  it("flattens nested snapshots and highlights changes", () => {
    expect(flattenRecord({ attachedTo: { invoiceId: "inv-1" } })).toEqual({ "attachedTo.invoiceId": "inv-1" });
    const rows = diffRecords({ status: "DRAFT", net: 10 }, { status: "POSTED", vat: 2 });
    expect(rows.find((row) => row.path === "status")).toMatchObject({ change: "changed", before: "DRAFT", after: "POSTED" });
    expect(rows.find((row) => row.path === "net")).toMatchObject({ change: "removed" });
    expect(rows.find((row) => row.path === "vat")).toMatchObject({ change: "added" });
  });
});

describe("digital links and HMRC context", () => {
  it("merges API links with metadata ids", () => {
    const entities = linkedEntities(entry(), links);
    expect(entities.map((item) => item.type)).toEqual(expect.arrayContaining(["document", "invoice", "vat_return"]));
    expect(digitalLinkResourceId(entry({ resourceId: null, metadata: { documentId: "doc-9" } }))).toBe("doc-9");
  });

  it("exposes HMRC submission id for VAT and ITSA only", () => {
    const vat = hmrcContext(entry({ resourceType: "vat_return", afterData: { status: "SUBMITTED", formBundleNumber: "FB-1" } }), links);
    expect(vat.visible).toBe(true);
    expect(vat.submissionId).toBe("FB-1");
    expect(hmrcContext(entry(), links).visible).toBe(false);
  });
});

describe("export helpers", () => {
  it("builds a tax-year period and a CSV trail", () => {
    expect(exportPeriod({ clientId: "c1", resourceType: "", action: "", from: "2026-04-06", to: "2027-04-05" })).toBe(
      "2026-04-06/2027-04-05",
    );
    expect(exportPeriod({ clientId: "", resourceType: "", action: "", from: "", to: "" })).toMatch(/^\d{4}-04$/);
    const csv = auditExportCsv([entry()]);
    expect(csv.split("\n")[0]).toContain("Timestamp");
    expect(csv).toContain("Amelia Hartley");
    expect(csv).toContain("Invoice total changed from 1000 to 1200");
  });
});
