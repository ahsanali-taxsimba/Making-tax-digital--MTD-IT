import { UserRole } from "@prisma/client";
import { AuthUser } from "../../common/types";

export function obligationSyncActor(firmId: string, clientId?: string | null): AuthUser {
  return {
    id: "system:obligation-sync",
    email: "system@mtd.internal",
    name: "Obligation sync",
    role: UserRole.ADMIN,
    firmId,
    clientId: clientId ?? null,
    principal: "firm",
    firmRole: "firm_admin",
  };
}
