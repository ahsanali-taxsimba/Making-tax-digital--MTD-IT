"use client";

import { useEffect, useState } from "react";
import {
  SESSION_EVENT,
  canManageConnection,
  getEnvironment,
  getSelectedClientId,
  getUser,
} from "@/lib/session";
import type { AuthUser } from "@/lib/types";

export function useSession() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [environment, setEnvironment] = useState<"sandbox" | "live">("sandbox");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sync = () => {
      setUser(getUser());
      setClientId(getSelectedClientId());
      setEnvironment(getEnvironment());
      setReady(true);
    };
    sync();
    window.addEventListener(SESSION_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SESSION_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return {
    user,
    clientId,
    environment,
    ready,
    isAuthenticated: Boolean(user),
    canManage: canManageConnection(user?.role),
  };
}
