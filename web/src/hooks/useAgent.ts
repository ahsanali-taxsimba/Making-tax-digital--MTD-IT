"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  applyAgentAction,
  askAgent,
  createAgentConversation,
  dismissAgentAction,
  getAgentConversation,
  listAgentConversations,
  type AgentConversation,
} from "@/lib/agent";

export function useAgentConversations() {
  return useQuery({ queryKey: ["agent-conversations"], queryFn: listAgentConversations });
}

export function useAgentConversation(id?: string | null) {
  return useQuery({
    queryKey: ["agent-conversation", id],
    queryFn: () => getAgentConversation(id!),
    enabled: Boolean(id),
  });
}

function cacheConversation(client: ReturnType<typeof useQueryClient>, conversation: AgentConversation) {
  client.setQueryData(["agent-conversation", conversation.id], conversation);
  void client.invalidateQueries({ queryKey: ["agent-conversations"] });
}

export function useAskAgent() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ content, conversationId }: { content: string; conversationId?: string }) =>
      askAgent(content, conversationId),
    onSuccess: (conversation) => cacheConversation(client, conversation),
  });
}

export function useCreateAgentConversation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (title?: string) => createAgentConversation(title),
    onSuccess: (conversation) => cacheConversation(client, conversation),
  });
}

export function useApplyAgentAction() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: applyAgentAction,
    onSuccess: (conversation) => cacheConversation(client, conversation),
  });
}

export function useDismissAgentAction() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: dismissAgentAction,
    onSuccess: (conversation) => cacheConversation(client, conversation),
  });
}
