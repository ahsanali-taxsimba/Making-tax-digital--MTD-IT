import { auditActionFor, IDENTITY_HEADERS, LOGICAL_SERVICES, serviceForPath } from "./service-catalog";

describe("service catalog", () => {
  it("covers all thirteen logical services", () => {
    expect(LOGICAL_SERVICES).toHaveLength(13);
    expect(serviceForPath("/vat/returns")).toBe("mtd-vat");
    expect(serviceForPath("/itsa/eops")).toBe("mtd-itsa");
    expect(serviceForPath("/yapily/accounts")).toBe("bank-feeds");
    expect(serviceForPath("/agent/conversations")).toBe("bookkeeping");
    expect(serviceForPath("/admin/feature-flags")).toBe("platform-admin");
    expect(IDENTITY_HEADERS.firmId).toBe("x-mtd-firm-id");
  });

  it("maps mutating routes onto HMRC audit actions", () => {
    expect(auditActionFor("POST", "/vat/returns")).toBe("vat.return.submitted");
    expect(auditActionFor("POST", "/itsa/quarterly-update")).toBe("itsa.update.submitted");
    expect(auditActionFor("DELETE", "/documents/doc-1")).toBe("document.deleted");
  });
});
