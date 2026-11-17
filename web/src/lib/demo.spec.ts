import { DEMO_USERS, handleDemoRequest } from "./demo";

describe("demo API fixtures", () => {
  it("loads a practice dashboard for sample walkthroughs", () => {
    const dashboard = handleDemoRequest<{ firm: { name: string }; clientCount: number }>("/firms/me/dashboard");
    expect(dashboard.firm.name).toBe("Northbridge Accountants LLP");
    expect(dashboard.clientCount).toBe(3);
    expect(DEMO_USERS.practice.firmRole).toBe("firm_admin");
  });

  it("scopes the client portal to Amelia Hartley", () => {
    const me = handleDemoRequest<{ name: string }>("/client/me");
    const obligations = handleDemoRequest<{ vat: unknown[]; itsa: unknown[] }>("/client/obligations");
    expect(me.name).toBe("Amelia Hartley");
    expect(obligations.vat).toHaveLength(1);
    expect(obligations.itsa).toHaveLength(1);
  });
});
