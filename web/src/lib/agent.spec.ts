import {
  agentActionKindLabel,
  agentActionStatusLabel,
  canApplyAgentActions,
  isAgentUpgradeError,
} from "./agent";

describe("agent helpers", () => {
  it("labels confirmable action cards", () => {
    expect(agentActionKindLabel("APPLY_CATEGORY")).toBe("Categorise");
    expect(agentActionKindLabel("APPLY_MATCH")).toBe("Match");
    expect(agentActionStatusLabel("PROPOSED")).toBe("Needs confirmation");
    expect(agentActionStatusLabel("APPLIED")).toBe("Posted");
  });

  it("lets accountants apply and keeps the copilot off Lite", () => {
    expect(canApplyAgentActions("firm_accountant")).toBe(true);
    expect(canApplyAgentActions("ACCOUNTANT")).toBe(true);
    expect(canApplyAgentActions("firm_staff")).toBe(false);
    expect(isAgentUpgradeError({ errorCode: "BILLING_FEATURE_REQUIRED" })).toBe(true);
  });
});
