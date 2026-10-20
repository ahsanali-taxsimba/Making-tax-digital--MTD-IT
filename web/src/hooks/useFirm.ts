"use client";

import { useQuery } from "@tanstack/react-query";
import { getFirm, getFirmDashboard } from "@/lib/firm";

export function useFirm(enabled = true) {
  const firm = useQuery({
    queryKey: ["firm"],
    queryFn: getFirm,
    enabled,
  });
  const dashboard = useQuery({
    queryKey: ["firm-dashboard"],
    queryFn: getFirmDashboard,
    enabled,
  });
  return { firm, dashboard };
}
