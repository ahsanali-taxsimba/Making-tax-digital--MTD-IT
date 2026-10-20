"use client";

import { useQuery } from "@tanstack/react-query";
import { getClient, getMyClient } from "@/lib/clients";
import { isFirmClient } from "@/lib/session";
import { getClientWorkspaceMe } from "@/lib/client-workspace";
import { useSession } from "./useSession";

export function useClient() {
  const { user, clientId } = useSession();
  const clientUser = isFirmClient(user);
  const scopedId = clientUser ? user?.clientId : clientId;
  return useQuery({
    queryKey: ["client-me", scopedId],
    queryFn: () => (clientUser ? getClientWorkspaceMe() : scopedId ? getClient(scopedId) : getMyClient()),
    enabled: Boolean(user) && (clientUser || Boolean(scopedId)),
  });
}
