"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ClientPicker } from "./ClientPicker";
import { pageTitle } from "@/lib/practice";

function setParam(params: URLSearchParams, key: string, value: string) {
  const next = new URLSearchParams(params);
  if (value) {
    next.set(key, value);
  } else {
    next.delete(key);
  }
  return next;
}

export function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const query = params.get("q") ?? "";
  const onClients = pathname.startsWith("/practice/clients");
  const onStaff = pathname.startsWith("/practice/staff");
  const onHmrc = pathname.startsWith("/practice/hmrc");
  const onTasks = pathname.startsWith("/practice/tasks");

  function replace(next: URLSearchParams) {
    const suffix = next.toString();
    router.replace(suffix ? `${pathname}?${suffix}` : pathname);
  }

  return (
    <header className="border-b border-line bg-white/90 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">Making Tax Digital</p>
          <h1 className="text-lg font-semibold text-ink">{pageTitle(pathname)}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <span className="sr-only">Search</span>
            <input
              className="w-56 rounded-lg border border-line bg-white px-3 py-1.5 text-sm"
              placeholder="Search practice…"
              value={query}
              onChange={(event) => replace(setParam(params, "q", event.target.value))}
            />
          </label>
          {onClients ? (
            <>
              <select
                className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm"
                value={params.get("type") ?? ""}
                onChange={(event) => replace(setParam(params, "type", event.target.value))}
                aria-label="Client type"
              >
                <option value="">All types</option>
                <option value="INDIVIDUAL">Individual</option>
                <option value="COMPANY">Company</option>
                <option value="LANDLORD">Landlord</option>
                <option value="PARTNERSHIP">Partnership</option>
              </select>
              <select
                className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm"
                value={params.get("hmrc") ?? ""}
                onChange={(event) => replace(setParam(params, "hmrc", event.target.value))}
                aria-label="HMRC status"
              >
                <option value="">All HMRC statuses</option>
                <option value="connected">Connected</option>
                <option value="not_connected">Not connected</option>
                <option value="disconnected">Disconnected</option>
              </select>
              <select
                className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm"
                value={params.get("risk") ?? ""}
                onChange={(event) => replace(setParam(params, "risk", event.target.value))}
                aria-label="Risk level"
              >
                <option value="">All risk levels</option>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
            </>
          ) : null}
          {onStaff ? (
            <>
              <select
                className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm"
                value={params.get("role") ?? ""}
                onChange={(event) => replace(setParam(params, "role", event.target.value))}
                aria-label="Staff role"
              >
                <option value="">All roles</option>
                <option value="ADMIN">Admin</option>
                <option value="ACCOUNTANT">Accountant</option>
                <option value="ASSISTANT">Assistant</option>
              </select>
              <select
                className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm"
                value={params.get("status") ?? ""}
                onChange={(event) => replace(setParam(params, "status", event.target.value))}
                aria-label="Staff status"
              >
                <option value="">All statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="INVITED">Invited</option>
                <option value="SUSPENDED">Deactivated</option>
              </select>
            </>
          ) : null}
          {onTasks ? (
            <select
              className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm"
              value={params.get("type") ?? ""}
              onChange={(event) => replace(setParam(params, "type", event.target.value))}
              aria-label="Task type"
            >
              <option value="">All task types</option>
              <option value="VAT_RETURN">VAT return</option>
              <option value="ITSA_UPDATE">ITSA update</option>
              <option value="EOPS">EOPS</option>
              <option value="FINAL_DECLARATION">Final declaration</option>
              <option value="BOOKKEEPING">Bookkeeping</option>
              <option value="RECONCILIATION">Reconciliation</option>
            </select>
          ) : null}
          {onHmrc ? (
            <select
              className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm"
              value={params.get("hmrc") ?? ""}
              onChange={(event) => replace(setParam(params, "hmrc", event.target.value))}
              aria-label="Connection status"
            >
              <option value="">All connections</option>
              <option value="connected">Connected</option>
              <option value="not_connected">Not connected</option>
            </select>
          ) : null}
          <ClientPicker />
        </div>
      </div>
    </header>
  );
}
