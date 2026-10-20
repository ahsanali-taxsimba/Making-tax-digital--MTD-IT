"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchDigitalLinksItsa, getEops, getFinalDeclaration, getQuarterlyUpdate } from "@/lib/digital-links-itsa";

export function useDigitalLinksITSA(resourceId?: string | null) {
  return useQuery({
    queryKey: ["digital-links-itsa-timeline", resourceId],
    queryFn: () => fetchDigitalLinksItsa(resourceId!),
    enabled: Boolean(resourceId),
    retry: false,
  });
}

export function useDigitalLinkQuarterly(id?: string | null) {
  return useQuery({
    queryKey: ["digital-link-itsa-quarterly", id],
    queryFn: () => getQuarterlyUpdate(id!),
    enabled: Boolean(id),
    retry: false,
  });
}

export function useDigitalLinkEops(id?: string | null) {
  return useQuery({
    queryKey: ["digital-link-itsa-eops", id],
    queryFn: () => getEops(id!),
    enabled: Boolean(id),
    retry: false,
  });
}

export function useDigitalLinkFinal(id?: string | null) {
  return useQuery({
    queryKey: ["digital-link-itsa-final", id],
    queryFn: () => getFinalDeclaration(id!),
    enabled: Boolean(id),
    retry: false,
  });
}
