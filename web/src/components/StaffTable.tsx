"use client";

import { useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { useInviteStaff, useUpdateStaff } from "@/hooks/useStaff";
import { useSession } from "@/hooks/useSession";
import { roleLabel, statusLabel } from "@/lib/practice";
import { canInviteStaff } from "@/lib/session";
import type { StaffMember, UserRole } from "@/lib/types";
import { ErrorBanner } from "./ErrorBanner";

const STAFF_ROLES: UserRole[] = ["ADMIN", "ACCOUNTANT", "ASSISTANT"];

export function StaffTable({
  rows,
  currentUserId,
  role,
}: {
  rows: StaffMember[];
  currentUserId?: string;
  role?: string | null;
}) {
  const invite = useInviteStaff();
  const update = useUpdateStaff();
  const params = useSearchParams();
  const [open, setOpen] = useState(params.get("invite") === "1");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("ACCOUNTANT");
  const { user } = useSession();
  const admin = canInviteStaff(role, user);

  async function onInvite(event: FormEvent) {
    event.preventDefault();
    await invite.mutateAsync({ name, email, role: newRole });
    setName("");
    setEmail("");
    setNewRole("ACCOUNTANT");
    setOpen(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-muted">{rows.length} staff members</p>
        {admin ? (
          <button
            type="button"
            className="rounded-xl bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-dark"
            onClick={() => setOpen((value) => !value)}
          >
            Invite staff
          </button>
        ) : null}
      </div>
      {open ? (
        <form onSubmit={onInvite} className="grid gap-3 rounded-2xl border border-line bg-white p-4 md:grid-cols-4">
          {invite.error ? <ErrorBanner title="Invite failed" message={invite.error.message} /> : null}
          <input
            className="rounded-lg border border-line px-3 py-2 text-sm"
            placeholder="Full name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
          <input
            className="rounded-lg border border-line px-3 py-2 text-sm"
            type="email"
            placeholder="Work email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <select
            className="rounded-lg border border-line px-3 py-2 text-sm"
            value={newRole}
            onChange={(event) => setNewRole(event.target.value as UserRole)}
          >
            {STAFF_ROLES.map((item) => (
              <option key={item} value={item}>
                {roleLabel(item)}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={invite.isPending}
            className="rounded-xl bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-dark disabled:opacity-60"
          >
            {invite.isPending ? "Sending…" : "Send invite"}
          </button>
        </form>
      ) : null}
      <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-paper text-xs uppercase tracking-[0.12em] text-ink-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Role</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Email</th>
              {admin ? <th className="px-4 py-3 font-semibold">Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-line">
                <td className="px-4 py-3 font-medium text-ink">{row.name}</td>
                <td className="px-4 py-3">
                  {admin && row.id !== currentUserId ? (
                    <select
                      className="rounded-lg border border-line px-2 py-1"
                      value={row.role}
                      onChange={(event) => update.mutate({ id: row.id, role: event.target.value as UserRole })}
                    >
                      {STAFF_ROLES.map((item) => (
                        <option key={item} value={item}>
                          {roleLabel(item)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    roleLabel(row.role)
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase ${
                      row.status === "ACTIVE"
                        ? "bg-success-soft text-success"
                        : row.status === "INVITED"
                          ? "bg-amber-50 text-amber-800"
                          : "bg-danger-soft text-danger"
                    }`}
                  >
                    {statusLabel(row.status)}
                  </span>
                </td>
                <td className="px-4 py-3 text-ink-muted">{row.email}</td>
                {admin ? (
                  <td className="px-4 py-3">
                    {row.id === currentUserId || row.status === "SUSPENDED" ? (
                      <span className="text-ink-muted">—</span>
                    ) : (
                      <button
                        type="button"
                        className="text-danger underline-offset-2 hover:underline"
                        onClick={() => update.mutate({ id: row.id, status: "SUSPENDED" })}
                      >
                        Deactivate
                      </button>
                    )}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
