"use client";

import { useQuery } from "@tanstack/react-query";
import { listClients } from "@/lib/clients";

export function useClients(enabled = true) {
  return useQuery({
    queryKey: ["clients"],
    queryFn: listClients,
    enabled,
  });
}
