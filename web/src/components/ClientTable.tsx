"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { useCreateClient, useUpdateClient } from "@/hooks/useClients";
import { setSelectedClientId } from "@/lib/session";
import { clientHmrcStatus, clientTypeLabel, hmrcStatusLabel, riskLabel } from "@/lib/practice";
import type { ClientRecord, ClientType, RiskLevel, StaffMember } from "@/lib/types";
import { ErrorBanner } from "./ErrorBanner";

export function ClientTable({
  rows,
  staff,
  canCreate,
}: {
  rows: ClientRecord[];
  staff: StaffMember[];
  canCreate?: boolean;
}) {
  const create = useCreateClient();
  const update = useUpdateClient();
  const params = useSearchParams();
  const [open, setOpen] = useState(params.get("new") === "1");
  const [name, setName] = useState("");
  const [type, setType] = useState<ClientType>("INDIVIDUAL");
  const [riskLevel, setRiskLevel] = useState<RiskLevel>("MEDIUM");
  const [assignedUserId, setAssignedUserId] = useState("");
  const [utr, setUtr] = useState("");
  const [nino, setNino] = useState("");
  const [vrn, setVrn] = useState("");

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    await create.mutateAsync({
      name,
      type,
      riskLevel,
      assignedUserId: assignedUserId || undefined,
      utr: utr || undefined,
      nino: nino || undefined,
      vatRegistrationNumber: vrn || undefined,
    });
    setName("");
    setUtr("");
    setNino("");
    setVrn("");
    setOpen(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-muted">{rows.length} clients</p>
        {canCreate ? (
          <button
            type="button"
            className="rounded-xl bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-dark"
            onClick={() => setOpen((value) => !value)}
          >
            Add client
          </button>
        ) : null}
      </div>
      {open ? (
        <form onSubmit={onCreate} className="grid gap-3 rounded-2xl border border-line bg-white p-4 md:grid-cols-3">
          {create.error ? <div className="md:col-span-3"><ErrorBanner title="Could not create client" message={create.error.message} /></div> : null}
          <input
            className="rounded-lg border border-line px-3 py-2 text-sm"
            placeholder="Client name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
          <select className="rounded-lg border border-line px-3 py-2 text-sm" value={type} onChange={(event) => setType(event.target.value as ClientType)}>
            <option value="INDIVIDUAL">Individual</option>
            <option value="COMPANY">Company</option>
            <option value="LANDLORD">Landlord</option>
            <option value="PARTNERSHIP">Partnership</option>
          </select>
          <select className="rounded-lg border border-line px-3 py-2 text-sm" value={riskLevel} onChange={(event) => setRiskLevel(event.target.value as RiskLevel)}>
            <option value="LOW">Low risk</option>
            <option value="MEDIUM">Medium risk</option>
            <option value="HIGH">High risk</option>
          </select>
          <select className="rounded-lg border border-line px-3 py-2 text-sm" value={assignedUserId} onChange={(event) => setAssignedUserId(event.target.value)}>
            <option value="">Unassigned accountant</option>
            {staff.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
          <input className="rounded-lg border border-line px-3 py-2 text-sm" placeholder="UTR" value={utr} onChange={(event) => setUtr(event.target.value)} />
          <input className="rounded-lg border border-line px-3 py-2 text-sm" placeholder="NINO" value={nino} onChange={(event) => setNino(event.target.value)} />
          <input className="rounded-lg border border-line px-3 py-2 text-sm" placeholder="VRN" value={vrn} onChange={(event) => setVrn(event.target.value)} />
          <button type="submit" disabled={create.isPending} className="rounded-xl bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-dark disabled:opacity-60">
            {create.isPending ? "Saving…" : "Create client"}
          </button>
        </form>
      ) : null}
      <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-paper text-xs uppercase tracking-[0.12em] text-ink-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Client</th>
              <th className="px-4 py-3 font-semibold">Type</th>
              <th className="px-4 py-3 font-semibold">HMRC</th>
              <th className="px-4 py-3 font-semibold">Risk</th>
              <th className="px-4 py-3 font-semibold">Accountant</th>
              <th className="px-4 py-3 font-semibold">Workspace</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const hmrc = clientHmrcStatus(row);
              return (
                <tr key={row.id} className="border-t border-line">
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink">{row.name}</p>
                    <p className="text-xs text-ink-muted">{row.nino || row.vatRegistrationNumber || row.utr || "No tax refs"}</p>
                  </td>
                  <td className="px-4 py-3">{clientTypeLabel(row.type)}</td>
                  <td className="px-4 py-3">{hmrcStatusLabel(hmrc)}</td>
                  <td className="px-4 py-3">{riskLabel(row.riskLevel)}</td>
                  <td className="px-4 py-3">
                    <select
                      className="rounded-lg border border-line px-2 py-1"
                      value={row.assignedUserId ?? ""}
                      onChange={(event) =>
                        update.mutate({ id: row.id, assignedUserId: event.target.value || null })
                      }
                    >
                      <option value="">Unassigned</option>
                      {staff.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/practice/clients/${row.id}`}
                      className="font-semibold text-teal underline-offset-2 hover:underline"
                      onClick={() => setSelectedClientId(row.id)}
                    >
                      Open workspace
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
