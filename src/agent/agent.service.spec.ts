import { BillingStatus } from "@prisma/client";
import { AgentService } from "./agent.service";
import { MockAgentLlm } from "./agent.llm.mock";

describe("AgentService", () => {
  const conversation = { id: "conv-1", firmId: "firm-1", userId: "u1", title: "Bookkeeping", updatedAt: new Date() };
  const prisma = {
    agentConversation: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    agentMessage: { create: jest.fn(), findMany: jest.fn() },
    agentAction: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  };
  const billing = { assertFeature: jest.fn().mockResolvedValue(undefined) };
  const tools = {
    run: jest.fn().mockImplementation((_user: unknown, name: string) => {
      if (name === "practice_overview") {
        return { clients: 2, unmatchedBank: 3, overdueInvoices: 1, openVat: 1, openItsa: 0, openTasks: 4 };
      }
      if (name === "suggest_categories") {
        return {
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
        };
      }
      return {};
    }),
  };
  const categorisation = { apply: jest.fn().mockResolvedValue({ alreadyApplied: false }) };
  const matching = { apply: jest.fn() };
  const invoices = { createInvoice: jest.fn() };
  const tasks = { create: jest.fn() };
  const audit = { record: jest.fn() };
  const llm = new MockAgentLlm();
  const service = new AgentService(
    prisma as never,
    billing as never,
    tools as never,
    categorisation as never,
    matching as never,
    invoices as never,
    tasks as never,
    audit as never,
    llm,
  );
  const user = { id: "u1", firmId: "firm-1", role: "ADMIN", email: "p", name: "Priya", clientId: null } as never;

  beforeEach(() => {
    jest.clearAllMocks();
    billing.assertFeature.mockResolvedValue(undefined);
    prisma.agentConversation.create.mockResolvedValue(conversation);
    prisma.agentConversation.update.mockResolvedValue(conversation);
    prisma.agentConversation.findFirst.mockResolvedValue({
      ...conversation,
      messages: [{ id: "m1", role: "assistant", content: "Here is what needs attention: unmatched bank lines", createdAt: new Date() }],
      actions: [],
    });
    prisma.agentMessage.create.mockResolvedValue({ id: "msg-1" });
    prisma.agentMessage.findMany.mockResolvedValue([{ role: "user", content: "What needs my attention?" }]);
    prisma.agentAction.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: "act-1", kind: data.kind, ...data }),
    );
  });

  it("briefs the practice from live overview tools without posting", async () => {
    const result = await service.ask(user, undefined, "What needs my attention?");
    expect(billing.assertFeature).toHaveBeenCalledWith("firm-1", "bookkeeping_agent");
    expect(tools.run).toHaveBeenCalledWith(user, "practice_overview", {});
    expect(result.messages.some((row) => row.content.includes("unmatched bank"))).toBe(true);
    expect(categorisation.apply).not.toHaveBeenCalled();
  });

  it("queues confirmable categorisation cards from unmatched bank lines", async () => {
    prisma.agentMessage.findMany.mockResolvedValue([{ role: "user", content: "Categorise unmatched bank lines" }]);
    prisma.agentConversation.findFirst.mockResolvedValue({
      ...conversation,
      messages: [{ id: "m2", role: "assistant", content: "coded", createdAt: new Date() }],
      actions: [{ id: "act-1", kind: "APPLY_CATEGORY", status: "PROPOSED", title: "Code BP Fuel", summary: "3080", clientId: "c1", payload: {}, createdAt: new Date(), resolvedAt: null }],
    });
    const result = await service.ask(user, "conv-1", "Categorise unmatched bank lines");
    expect(prisma.agentAction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ kind: "APPLY_CATEGORY" }),
      }),
    );
    expect(result.actions[0].kind).toBe("APPLY_CATEGORY");
    expect(result.actions[0].status).toBe("PROPOSED");
  });

  it("applies a proposed category through the categorisation engine", async () => {
    prisma.agentAction.findUnique.mockResolvedValue({
      id: "act-1",
      kind: "APPLY_CATEGORY",
      status: "PROPOSED",
      conversationId: "conv-1",
      clientId: "c1",
      payload: { suggestionId: "sug-1", bankTransactionId: "txn-1" },
      conversation: { firmId: "firm-1", userId: "u1" },
    });
    await service.applyAction(user, "act-1");
    expect(categorisation.apply).toHaveBeenCalledWith(user, { suggestionId: "sug-1", bankTransactionId: "txn-1" });
    expect(prisma.agentAction.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "APPLIED" }) }));
  });

  it("refuses other firms' conversations", async () => {
    prisma.agentConversation.findFirst.mockResolvedValue(null);
    await expect(service.getConversation(user, "conv-other")).rejects.toThrow(/not found/i);
  });
});

describe("billing gate", () => {
  it("uses BillingStatus only as a fixture tag", () => {
    expect(BillingStatus.TRIAL).toBeDefined();
  });
});
