import { detectIntent, toolsForIntent } from "./agent.planner";

describe("agent planner", () => {
  it("routes UK bookkeeping questions onto the matching tool set", () => {
    expect(detectIntent("What needs my attention today?")).toBe("overview");
    expect(detectIntent("Categorise unmatched bank lines")).toBe("categorise");
    expect(detectIntent("Match invoices and bills")).toBe("match");
    expect(detectIntent("Who owes us money?")).toBe("invoices");
    expect(detectIntent("VAT position this quarter")).toBe("vat");
    expect(detectIntent("ITSA quarterly updates due")).toBe("itsa");
    expect(toolsForIntent("categorise", "code the bank").map((row) => row.name)).toEqual([
      "list_uncategorised_bank",
      "suggest_categories",
    ]);
  });
});
