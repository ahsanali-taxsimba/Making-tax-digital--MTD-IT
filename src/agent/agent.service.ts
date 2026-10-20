import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, TaskType } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { BillingService } from "../billing/billing.service";
import { AuthUser } from "../common/types";
import { InvoiceService } from "../bookkeeping/invoice.service";
import { CategorisationService } from "../categorisation/categorisation.service";
import { MatchingService } from "../matching/matching.service";
import { PrismaService } from "../prisma/prisma.service";
import { TasksService } from "../tasks/tasks.service";
import { AGENT_LLM } from "./agent.tokens";
import { AgentToolsService } from "./agent.tools";
import { AGENT_TOOLS, AgentChatMessage, AgentLlm, AgentToolCall } from "./agent.types";

const SYSTEM_PROMPT = [
  "You are Ledger, a UK Making Tax Digital bookkeeping agent for one accountancy firm.",
  "Use tools for every figure. Never invent amounts, VAT boxes, or HMRC status.",
  "Scope is this firm only. Do not ask for data from other practices.",
  "Never post journals, invoices, matches or HMRC submissions yourself. Queue propose_action and wait for the accountant to apply it.",
  "Talk like a UK accountant. Amounts in GBP. Digital links still apply: VAT/ITSA submit stays in those workspaces.",
].join(" ");

const MAX_TOOL_ROUNDS = 4;

@Injectable()
export class AgentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: BillingService,
    private readonly tools: AgentToolsService,
    private readonly categorisation: CategorisationService,
    private readonly matching: MatchingService,
    private readonly invoices: InvoiceService,
    private readonly tasks: TasksService,
    private readonly audit: AuditService,
    @Inject(AGENT_LLM) private readonly llm: AgentLlm,
  ) {}

  async listConversations(user: AuthUser) {
    await this.assertCanUse(user);
    const rows = await this.prisma.agentConversation.findMany({
      where: { firmId: user.firmId, userId: user.id },
      orderBy: { updatedAt: "desc" },
      take: 30,
      include: { _count: { select: { messages: true, actions: true } } },
    });
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      updatedAt: row.updatedAt,
      messageCount: row._count.messages,
      actionCount: row._count.actions,
    }));
  }

  async createConversation(user: AuthUser, title?: string) {
    await this.assertCanUse(user);
    const row = await this.prisma.agentConversation.create({
      data: { firmId: user.firmId, userId: user.id, title: title?.trim() || "Bookkeeping" },
    });
    return this.getConversation(user, row.id);
  }

  async getConversation(user: AuthUser, id: string) {
    await this.assertCanUse(user);
    const row = await this.requireConversation(user, id);
    return this.present(row);
  }

  async ask(user: AuthUser, conversationId: string | undefined, content: string) {
    await this.assertCanUse(user);
    const conversation = conversationId
      ? await this.requireConversation(user, conversationId)
      : await this.prisma.agentConversation.create({
          data: { firmId: user.firmId, userId: user.id, title: titleFrom(content) },
        });
    await this.prisma.agentMessage.create({
      data: { conversationId: conversation.id, role: "user", content },
    });
    const history = await this.prisma.agentMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "asc" },
      take: 40,
    });
    const chat: AgentChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history.filter((row) => row.role === "user" || row.role === "assistant").map((row) => ({
        role: row.role as "user" | "assistant",
        content: row.content,
      })),
    ];

    let assistantText = "";
    let lastToolCalls: AgentToolCall[] = [];
    for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
      const result = await this.llm.complete(chat, AGENT_TOOLS);
      if (!result.toolCalls.length) {
        assistantText = result.content.trim();
        break;
      }
      lastToolCalls = result.toolCalls;
      chat.push({ role: "assistant", content: result.content ?? "", toolCalls: result.toolCalls });
      for (const call of result.toolCalls) {
        const output = call.name === "propose_action"
          ? await this.queueAction(conversation.id, call.arguments)
          : await this.tools.run(user, call.name, call.arguments ?? {});
        const serialized = JSON.stringify(output);
        await this.prisma.agentMessage.create({
          data: {
            conversationId: conversation.id,
            role: "tool",
            toolName: call.name,
            content: serialized.slice(0, 8000),
            toolCalls: call as unknown as Prisma.InputJsonValue,
          },
        });
        chat.push({ role: "tool", name: call.name, toolCallId: call.id, content: serialized.slice(0, 8000) });
      }
      assistantText = result.content.trim();
    }
    if (!assistantText) {
      assistantText = "I have pulled the live ledger for this firm. Confirm any action cards below before they post.";
    }
    const stored = await this.prisma.agentMessage.create({
      data: {
        conversationId: conversation.id,
        role: "assistant",
        content: assistantText,
        toolCalls: lastToolCalls.length ? (lastToolCalls as unknown as Prisma.InputJsonValue) : undefined,
      },
    });
    await this.prisma.agentConversation.update({
      where: { id: conversation.id },
      data: { title: conversation.title && conversation.title !== "Bookkeeping" ? conversation.title : titleFrom(content), updatedAt: new Date() },
    });
    await this.audit.record({
      actor: user,
      actionType: "agent.message",
      metadata: { conversationId: conversation.id, messageId: stored.id },
    });
    return this.getConversation(user, conversation.id);
  }

  async applyAction(user: AuthUser, actionId: string) {
    await this.assertCanUse(user);
    const action = await this.prisma.agentAction.findUnique({ where: { id: actionId }, include: { conversation: true } });
    if (!action || action.conversation.firmId !== user.firmId || action.conversation.userId !== user.id) {
      throw new NotFoundException("Action not found");
    }
    if (action.status !== "PROPOSED") {
      throw new BadRequestException("That action has already been resolved");
    }
    const payload = asRecord(action.payload);
    let result: unknown;
    try {
      if (action.kind === "APPLY_CATEGORY") {
        result = await this.categorisation.apply(user, {
          suggestionId: optionalString(payload.suggestionId),
          bankTransactionId: optionalString(payload.bankTransactionId),
        });
      } else if (action.kind === "APPLY_MATCH") {
        result = await this.matching.apply(user, {
          suggestionId: optionalString(payload.suggestionId),
          bankTransactionId: optionalString(payload.bankTransactionId),
        });
      } else if (action.kind === "CREATE_TASK") {
        result = await this.tasks.create(user, {
          clientId: String(payload.clientId ?? action.clientId ?? ""),
          title: String(payload.title ?? action.title),
          type: (payload.type as TaskType) ?? TaskType.BOOKKEEPING,
        });
      } else if (action.kind === "DRAFT_INVOICE") {
        result = await this.invoices.createInvoice(user, payload as never);
      } else {
        throw new BadRequestException(`Unsupported action ${action.kind}`);
      }
    } catch (error) {
      await this.prisma.agentAction.update({
        where: { id: action.id },
        data: { status: "FAILED", result: { message: error instanceof Error ? error.message : "failed" } as Prisma.InputJsonValue, resolvedAt: new Date() },
      });
      throw error;
    }
    await this.prisma.agentAction.update({
      where: { id: action.id },
      data: { status: "APPLIED", result: result as Prisma.InputJsonValue, resolvedAt: new Date() },
    });
    await this.audit.record({
      actor: user,
      clientId: action.clientId,
      actionType: "agent.action.applied",
      metadata: { actionId: action.id, kind: action.kind },
    });
    return this.getConversation(user, action.conversationId);
  }

  async dismissAction(user: AuthUser, actionId: string) {
    await this.assertCanUse(user);
    const action = await this.prisma.agentAction.findUnique({ where: { id: actionId }, include: { conversation: true } });
    if (!action || action.conversation.firmId !== user.firmId || action.conversation.userId !== user.id) {
      throw new NotFoundException("Action not found");
    }
    await this.prisma.agentAction.update({ where: { id: action.id }, data: { status: "DISMISSED", resolvedAt: new Date() } });
    return this.getConversation(user, action.conversationId);
  }

  private async queueAction(conversationId: string, args: Record<string, unknown>) {
    const payload = parsePayload(args.payload);
    const created = await this.prisma.agentAction.create({
      data: {
        conversationId,
        kind: String(args.kind ?? "CREATE_TASK"),
        title: String(args.title ?? "Proposed action"),
        summary: String(args.summary ?? ""),
        clientId: optionalString(args.clientId) ?? optionalString(payload.clientId),
        payload: payload as Prisma.InputJsonValue,
      },
    });
    return { queued: true, actionId: created.id, kind: created.kind };
  }

  private async assertCanUse(user: AuthUser) {
    await this.billing.assertFeature(user.firmId, "bookkeeping_agent");
  }

  private async requireConversation(user: AuthUser, id: string) {
    const row = await this.prisma.agentConversation.findFirst({
      where: { id, firmId: user.firmId, userId: user.id },
      include: {
        messages: { where: { role: { in: ["user", "assistant"] } }, orderBy: { createdAt: "asc" } },
        actions: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!row) {
      throw new NotFoundException("Conversation not found");
    }
    return row;
  }

  private present(row: {
    id: string;
    title: string | null;
    updatedAt: Date;
    messages: Array<{ id: string; role: string; content: string; createdAt: Date }>;
    actions: Array<{
      id: string;
      kind: string;
      status: string;
      title: string;
      summary: string;
      clientId: string | null;
      payload: unknown;
      createdAt: Date;
      resolvedAt: Date | null;
    }>;
  }) {
    return {
      id: row.id,
      title: row.title,
      updatedAt: row.updatedAt,
      llm: this.llm.name,
      messages: row.messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: message.createdAt,
      })),
      actions: row.actions.map((action) => ({
        id: action.id,
        kind: action.kind,
        status: action.status,
        title: action.title,
        summary: action.summary,
        clientId: action.clientId,
        payload: action.payload,
        createdAt: action.createdAt,
        resolvedAt: action.resolvedAt,
      })),
      prompts: [
        "What needs my attention?",
        "Categorise unmatched bank lines",
        "Match invoices and bills",
        "Who owes us money?",
        "VAT position this quarter",
        "ITSA obligations due",
      ],
    };
  }
}

function titleFrom(content: string): string {
  const trimmed = content.replace(/\s+/g, " ").trim();
  return trimmed.slice(0, 72) || "Bookkeeping";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function optionalString(value: unknown): string | undefined {
  const text = String(value ?? "").trim();
  return text.length ? text : undefined;
}

function parsePayload(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return asRecord(parsed);
    } catch {
      return { raw: value };
    }
  }
  return asRecord(value);
}
