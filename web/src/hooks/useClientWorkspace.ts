"use client";

import { useQuery } from "@tanstack/react-query";
import { getClientWorkspaceMe, listClientWorkspaceDocuments, listClientWorkspaceObligations } from "@/lib/client-workspace";
import { useSession } from "./useSession";
import { isFirmClient } from "@/lib/session";

export function useClientWorkspace() {
  const { user } = useSession();
  const enabled = isFirmClient(user);
  const me = useQuery({
    queryKey: ["client-workspace-me", user?.clientId],
    queryFn: getClientWorkspaceMe,
    enabled,
  });
  const documents = useQuery({
    queryKey: ["client-workspace-documents", user?.clientId],
    queryFn: listClientWorkspaceDocuments,
    enabled,
  });
  const obligations = useQuery({
    queryKey: ["client-workspace-obligations", user?.clientId],
    queryFn: listClientWorkspaceObligations,
    enabled,
  });
  return { me, documents, obligations, clientId: user?.clientId ?? null };
}
