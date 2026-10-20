import { ForbiddenException } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { AuthUser } from "./types";

export function assertFirmAccess(user: AuthUser, firmId: string): void {
  if (user.firmId !== firmId) {
    throw new ForbiddenException("Cross-firm access is not allowed");
  }
}

export function assertClientScope(user: AuthUser, client: { id: string; firmId: string }): void {
  assertFirmAccess(user, client.firmId);
  if (user.role === UserRole.CLIENT && user.clientId !== client.id) {
    throw new ForbiddenException("Clients can only access their own records");
  }
}

export function staffRoles(): UserRole[] {
  return [UserRole.ADMIN, UserRole.ACCOUNTANT];
}
