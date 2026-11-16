import { UserRole } from "@prisma/client";
import { AuthUser } from "./types";

export function systemActor(firmId: string): AuthUser {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    email: "system@making-tax-digital.local",
    role: UserRole.ADMIN,
    firmId,
    clientId: null,
    name: "System",
  };
}
