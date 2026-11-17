"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getFirmWorkspace,
  listFirmClients,
  listFirmDocuments,
  listFirmItsaSubmissions,
  listFirmVatReturns,
} from "@/lib/firm-workspace";

export function useFirmWorkspace() {
  const firm = useQuery({ queryKey: ["firm-workspace-me"], queryFn: getFirmWorkspace });
  const clients = useQuery({ queryKey: ["firm-workspace-clients"], queryFn: listFirmClients });
  const documents = useQuery({ queryKey: ["firm-workspace-documents"], queryFn: listFirmDocuments });
  const vat = useQuery({ queryKey: ["firm-workspace-vat"], queryFn: listFirmVatReturns });
  const itsa = useQuery({ queryKey: ["firm-workspace-itsa"], queryFn: listFirmItsaSubmissions });
  return { firm, clients, documents, vat, itsa };
}
