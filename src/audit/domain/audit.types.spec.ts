import { inferResourceId, inferResourceType } from "./audit.types";
import { parsePeriod } from "./period";

describe("inferResourceType", () => {
  it("prefers an explicit metadata resource type", () => {
    expect(inferResourceType("http.post", { resourceType: "invoice" })).toBe("invoice");
  });

  it("maps service action prefixes to HMRC resource types", () => {
    expect(inferResourceType("document.uploaded")).toBe("document");
    expect(inferResourceType("documents.post")).toBe("document");
    expect(inferResourceType("receipt.ocr.completed")).toBe("document");
    expect(inferResourceType("vat.return.submitted")).toBe("vat_return");
    expect(inferResourceType("itsa.quarterly.submitted")).toBe("itsa_submission");
    expect(inferResourceType("bookkeeping.invoice.posted")).toBe("invoice");
    expect(inferResourceType("bookkeeping.bill.posted")).toBe("bill");
    expect(inferResourceType("bank.import")).toBe("bank_transaction");
    expect(inferResourceType("yapily.pipeline.ran")).toBe("bank_transaction");
    expect(inferResourceType("categorisation.applied")).toBe("bank_transaction");
    expect(inferResourceType("auth.login")).toBe("user");
    expect(inferResourceType("user.updated")).toBe("user");
  });
});

describe("inferResourceId", () => {
  it("reads the first known identifier from metadata", () => {
    expect(inferResourceId({ documentId: "doc-1", invoiceId: "inv-1" })).toBe("doc-1");
    expect(inferResourceId({ vatReturnId: "vat-1" })).toBe("vat-1");
    expect(inferResourceId({})).toBeNull();
  });
});

describe("parsePeriod", () => {
  it("returns null for an empty period", () => {
    expect(parsePeriod()).toBeNull();
    expect(parsePeriod("  ")).toBeNull();
  });

  it("parses an ISO start/end pair", () => {
    const range = parsePeriod("2026-04-06/2027-04-05");
    expect(range?.start.toISOString()).toBe("2026-04-06T00:00:00.000Z");
    expect(range?.end.toISOString()).toBe("2027-04-05T00:00:00.000Z");
  });

  it("treats YYYY-MM as a UK tax year starting 6 April", () => {
    const range = parsePeriod("2026-04");
    expect(range?.start.toISOString()).toBe("2026-04-06T00:00:00.000Z");
    expect(range?.end.toISOString()).toBe("2027-04-05T23:59:59.999Z");
  });

  it("treats a single date as a one-year window", () => {
    const range = parsePeriod("2026-01-01");
    expect(range?.start.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(range?.end.getUTCFullYear()).toBe(2027);
  });
});
