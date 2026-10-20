"use client";

import { useQuery } from "@tanstack/react-query";
import { getClient, getMyClient } from "@/lib/clients";
import { useSession } from "./useSession";

export function useClient() {
  const { user, clientId } = useSession();
  const isClient = user?.role === "CLIENT";
  return useQuery({
    queryKey: ["client-me", isClient ? user?.clientId : clientId],
    queryFn: () => (isClient || !clientId ? getMyClient() : getClient(clientId)),
    enabled: Boolean(user),
  });
}
