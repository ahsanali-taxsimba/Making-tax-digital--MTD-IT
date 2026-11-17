"use client";

import { useQuery } from "@tanstack/react-query";
import { completeHmrcCallback } from "@/lib/hmrc";

export function useHmrcCallback(params: {
  code?: string;
  state?: string;
  environment?: string;
  error?: string;
  error_description?: string;
}) {
  const ready = Boolean(params.code && params.state) || Boolean(params.error);
  return useQuery({
    queryKey: ["hmrc-callback", params.code, params.state, params.environment, params.error],
    queryFn: () => completeHmrcCallback(params),
    enabled: ready,
    retry: false,
    staleTime: Infinity,
  });
}
