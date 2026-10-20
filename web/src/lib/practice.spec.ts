import { clientHmrcStatus, matchesQuery, pageTitle, roleLabel, taskColumn, taskTypeLabel } from "./practice";

describe("practice helpers", () => {
  it("maps board columns", () => {
    expect(taskColumn("OPEN")).toBe("OPEN");
    expect(taskColumn("WAITING_ON_CLIENT")).toBe("WAITING_ON_CLIENT");
    expect(taskColumn("CANCELLED")).toBe("HIDDEN");
  });

  it("labels VAT and ITSA aliases together", () => {
    expect(taskTypeLabel("VAT_RETURN")).toBe("VAT return");
    expect(taskTypeLabel("MTD_VAT_RETURN")).toBe("VAT return");
    expect(taskTypeLabel("EOPS")).toBe("EOPS");
  });

  it("derives HMRC status from connections", () => {
    expect(clientHmrcStatus({ mtdConnections: [] })).toBe("not_connected");
    expect(clientHmrcStatus({ mtdConnections: [{ disconnectedAt: "2026-01-01" }] })).toBe("disconnected");
    expect(clientHmrcStatus({ mtdConnections: [{ disconnectedAt: null, scopes: ["read:vat"] }] })).toBe("connected");
  });

  it("filters search terms", () => {
    expect(matchesQuery(["Amelia Hartley", "AA123456A"], "hart")).toBe(true);
    expect(matchesQuery(["James Cole"], "noah")).toBe(false);
  });

  it("titles the three role workspaces", () => {
    expect(pageTitle("/admin/overview")).toBe("Platform dashboard");
    expect(pageTitle("/practice/dashboard")).toBe("Dashboard");
    expect(pageTitle("/client/home")).toBe("Home");
    expect(roleLabel("admin_owner")).toBe("Platform owner");
    expect(roleLabel("firm_accountant")).toBe("Accountant");
    expect(roleLabel("CLIENT")).toBe("Client");
  });
});
