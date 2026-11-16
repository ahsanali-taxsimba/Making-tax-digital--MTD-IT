"use client";

import { useQuery } from "@tanstack/react-query";
import {
  fetchDigitalLinks,
  getBankTransaction,
  getDocument,
  getJournalEntry,
  getVatReturn,
} from "@/lib/digital-links";

export function useDigitalLinks(resourceId?: string | null) {
  return useQuery({
    queryKey: ["digital-links-timeline", resourceId],
    queryFn: () => fetchDigitalLinks(resourceId!),
    enabled: Boolean(resourceId),
    retry: false,
  });
}

export function useDigitalLinkDocument(id?: string | null) {
  return useQuery({
    queryKey: ["digital-link-document", id],
    queryFn: () => getDocument(id!),
    enabled: Boolean(id),
    retry: false,
  });
}

export function useDigitalLinkTransaction(id?: string | null) {
  return useQuery({
    queryKey: ["digital-link-bank", id],
    queryFn: () => getBankTransaction(id!),
    enabled: Boolean(id),
    retry: false,
  });
}

export function useDigitalLinkJournal(id?: string | null) {
  return useQuery({
    queryKey: ["digital-link-journal", id],
    queryFn: () => getJournalEntry(id!),
    enabled: Boolean(id),
    retry: false,
  });
}

export function useDigitalLinkVatReturn(id?: string | null) {
  return useQuery({
    queryKey: ["digital-link-vat", id],
    queryFn: () => getVatReturn(id!),
    enabled: Boolean(id),
    retry: false,
  });
}
