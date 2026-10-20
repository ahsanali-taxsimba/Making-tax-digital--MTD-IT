import { MockAgentLlm } from "./agent.llm.mock";

describe("MockAgentLlm", () => {
  const llm = new MockAgentLlm();

  it("plans bookkeeping tools then queues confirmable cards once", async () => {
    const first = await llm.complete([{ role: "user", content: "Categorise unmatched bank lines" }], []);
    expect(first.toolCalls.map((call) => call.name)).toEqual(["list_uncategorised_bank", "suggest_categories"]);

    const categoryTool = {
      role: "tool" as const,
      name: "suggest_categories",
      content: JSON.stringify({
        suggestions: [
          {
            id: "sug-1",
            bankTransactionId: "txn-1",
            clientId: "c1",
            merchantName: "BP Fuel",
            confidence: 0.91,
            suggestedLedger: { code: 3080, name: "Motor Expenses" },
          },
        ],
      }),
    };
    const second = await llm.complete(
      [{ role: "user", content: "Categorise unmatched bank lines" }, categoryTool],
      [],
    );
    expect(second.toolCalls).toHaveLength(1);
    expect(second.toolCalls[0].name).toBe("propose_action");
    expect(second.toolCalls[0].arguments.kind).toBe("APPLY_CATEGORY");

    const third = await llm.complete(
      [
        { role: "user", content: "Categorise unmatched bank lines" },
        categoryTool,
        { role: "tool", name: "propose_action", content: JSON.stringify({ queued: true, actionId: "act-1" }) },
      ],
      [],
    );
    expect(third.toolCalls).toEqual([]);
    expect(third.content).toMatch(/coded/i);
  });
});
