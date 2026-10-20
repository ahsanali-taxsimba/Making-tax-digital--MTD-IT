"use client";

import { useEffect } from "react";
import { setEnvironment, setSelectedClientId } from "@/lib/session";
import { useClients } from "@/hooks/useClients";
import { useSession } from "@/hooks/useSession";

export function ClientPicker() {
  const { user, clientId, environment, canManage } = useSession();
  const clients = useClients(Boolean(user) && canManage);

  useEffect(() => {
    if (!canManage || clientId || !clients.data?.length) {
      return;
    }
    const preferred =
      clients.data.find((item) => item.nino && item.vatRegistrationNumber) ??
      clients.data.find((item) => item.nino) ??
      clients.data.find((item) => item.vatRegistrationNumber) ??
      clients.data[0];
    setSelectedClientId(preferred.id);
  }, [canManage, clientId, clients.data]);

  if (!user) {
    return null;
  }

  if (!canManage) {
    const name = clients.data?.find((item) => item.id === user.clientId)?.name ?? "Your client";
    return <p className="text-sm text-ink-muted">{name}</p>;
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 text-sm">
        <span className="text-ink-muted">Client</span>
        <select
          className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm"
          value={clientId ?? ""}
          onChange={(event) => setSelectedClientId(event.target.value)}
        >
          <option value="" disabled>
            Select a client
          </option>
          {(clients.data ?? []).map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
              {item.vatRegistrationNumber ? ` · ${item.vatRegistrationNumber}` : ""}
              {item.nino ? ` · ${item.nino}` : ""}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <span className="text-ink-muted">Environment</span>
        <select
          className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm capitalize"
          value={environment}
          onChange={(event) => setEnvironment(event.target.value as "sandbox" | "live")}
        >
          <option value="sandbox">sandbox</option>
          <option value="live">live</option>
        </select>
      </label>
    </div>
  );
}
