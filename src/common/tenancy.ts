import { BadRequestException, ForbiddenException } from "@nestjs/common";
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
  return [UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.ASSISTANT];
}

export function resolveScopedClientId(user: AuthUser, requested?: string): string {
  if (user.role === UserRole.CLIENT) {
    if (!user.clientId) {
      throw new ForbiddenException("Client portal user is not linked to a client");
    }
    if (requested && requested !== user.clientId) {
      throw new ForbiddenException("Clients can only access their own records");
    }
    return user.clientId;
  }
  if (!requested) {
    throw new BadRequestException("clientId is required");
  }
  return requested;
}
