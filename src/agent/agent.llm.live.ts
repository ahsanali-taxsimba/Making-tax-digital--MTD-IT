import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AgentChatMessage, AgentLlm, AgentLlmResult, AgentToolCall, AgentToolSpec } from "./agent.types";

@Injectable()
export class LiveAgentLlm implements AgentLlm {
  readonly name = "live";
  private readonly logger = new Logger(LiveAgentLlm.name);

  constructor(private readonly config: ConfigService) {}

  async complete(messages: AgentChatMessage[], tools: AgentToolSpec[]): Promise<AgentLlmResult> {
    const apiKey = this.config.get<string>("agent.apiKey") ?? "";
    const baseUrl = (this.config.get<string>("agent.baseUrl") ?? "https://api.openai.com/v1").replace(/\/$/, "");
    const model = this.config.get<string>("agent.model") ?? "gpt-4.1-mini";
    if (!apiKey) {
      throw new Error("AGENT_LLM_API_KEY is required when AGENT_LLM_MODE=live");
    }
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: messages.map(toOpenAi),
        tools: tools.map((tool) => ({
          type: "function",
          function: { name: tool.name, description: tool.description, parameters: tool.parameters },
        })),
      }),
    });
    if (!response.ok) {
      const body = await response.text();
      this.logger.warn(`LLM ${response.status}: ${body.slice(0, 300)}`);
      throw new Error(`Bookkeeping agent LLM failed (${response.status})`);
    }
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null; tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }> } }>;
    };
    const message = payload.choices?.[0]?.message;
    const toolCalls: AgentToolCall[] = (message?.tool_calls ?? []).map((call) => ({
      id: call.id,
      name: call.function.name,
      arguments: parseArgs(call.function.arguments),
    }));
    return { content: message?.content ?? "", toolCalls };
  }
}

function toOpenAi(message: AgentChatMessage) {
  if (message.role === "tool") {
    return { role: "tool", tool_call_id: message.toolCallId, content: message.content, name: message.name };
  }
  if (message.toolCalls?.length) {
    return {
      role: message.role,
      content: message.content || null,
      tool_calls: message.toolCalls.map((call) => ({
        id: call.id,
        type: "function",
        function: { name: call.name, arguments: JSON.stringify(call.arguments ?? {}) },
      })),
    };
  }
  return { role: message.role, content: message.content };
}

function parseArgs(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw || "{}") as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
