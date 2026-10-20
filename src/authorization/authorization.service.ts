import { Injectable } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { AuthUser } from "../common/types";
import { AUTHZ_ERR, AuthorizationError } from "./authorization.errors";
import { canFirm, canPlatform, firmMayAccessPath, isClientDataPath, platformMayAccessPath } from "./domain/policy";
import {
  type AuthzResource,
  type FirmAction,
  type FirmUserView,
  type PlatformAction,
  type PlatformUserView,
  type ResourceType,
  publicFirmRole,
  publicPlatformRole,
  toFirmRole,
} from "./domain/roles";

@Injectable()
export class AuthorizationService {
  canPlatform(user: PlatformUserView | AuthUser, action: PlatformAction, resourceType?: ResourceType, resource?: AuthzResource) {
    const platform = this.asPlatform(user);
    return platform ? canPlatform(platform, action, resourceType, resource) : false;
  }

  canFirm(user: FirmUserView | AuthUser, action: FirmAction, resourceType: ResourceType, resource?: AuthzResource, restrictAccountantsToAssigned = false) {
    const firmUser = this.asFirm(user);
    return firmUser ? canFirm(firmUser, action, resourceType, resource, { restrictAccountantsToAssigned }) : false;
  }

  assertPlatform(user: AuthUser, action: PlatformAction, resourceType?: ResourceType, resource?: AuthzResource) {
    if (!this.canPlatform(user, action, resourceType, resource)) {
      throw new AuthorizationError(AUTHZ_ERR.DENIED, "Platform role cannot perform this action", { action, resourceType });
    }
  }

  assertFirm(user: AuthUser, action: FirmAction, resourceType: ResourceType, resource?: AuthzResource, restrictAccountantsToAssigned = false) {
    if (this.isPlatform(user)) {
      throw new AuthorizationError(AUTHZ_ERR.PLATFORM_CLIENT_DATA, "Platform staff cannot access firm or client records");
    }
    if (resource?.firmId && resource.firmId !== user.firmId) {
      throw new AuthorizationError(AUTHZ_ERR.CROSS_FIRM, "Cross-firm access is not allowed", { firmId: resource.firmId });
    }
    if (!this.canFirm(user, action, resourceType, resource, restrictAccountantsToAssigned)) {
      throw new AuthorizationError(AUTHZ_ERR.DENIED, "Insufficient firm role for this resource", { action, resourceType });
    }
  }

  assertCanAccessClientData(user: AuthUser, resource?: AuthzResource) {
    if (this.isPlatform(user)) {
      throw new AuthorizationError(AUTHZ_ERR.PLATFORM_CLIENT_DATA, "Platform owners cannot view client records, documents, or financials");
    }
    this.assertFirm(user, "view", resource?.clientId ? "client" : "firm", resource ?? { firmId: user.firmId });
  }

  assertRouteAccess(user: AuthUser, path: string) {
    if (this.isPlatform(user)) {
      const platform = this.asPlatform(user)!;
      if (!platformMayAccessPath(platform, path) || isClientDataPath(path)) {
        throw new AuthorizationError(AUTHZ_ERR.PLATFORM_CLIENT_DATA, "Platform staff cannot access client-level data");
      }
      return;
    }
    const firmUser = this.asFirm(user)!;
    if (!firmMayAccessPath(firmUser, path)) {
      throw new AuthorizationError(AUTHZ_ERR.DENIED, "This route is not available for the signed-in role");
    }
  }

  isPlatform(user?: AuthUser | null): boolean {
    return user?.principal === "platform" || Boolean(user?.platformRole);
  }

  asPlatform(user: AuthUser | PlatformUserView): PlatformUserView | null {
    if ("principal" in user && user.principal === "platform" && user.platformRole) {
      return {
        id: user.id,
        role: publicPlatformRole(user.platformRole),
        name: user.name,
        email: user.email,
        isActive: true,
      };
    }
    if ("role" in user && typeof user.role === "string" && String(user.role).toLowerCase().startsWith("admin_")) {
      return {
        id: user.id,
        role: publicPlatformRole(user.role),
        name: user.name,
        email: user.email,
        isActive: "isActive" in user ? Boolean(user.isActive) : true,
      };
    }
    return null;
  }

  asFirm(user: AuthUser | FirmUserView): FirmUserView | null {
    if (this.isPlatform(user as AuthUser)) {
      return null;
    }
    const role = "firmRole" in user && user.firmRole ? toFirmRole(user.firmRole) : publicFirmRole((user as AuthUser).role ?? UserRole.CLIENT);
    return {
      id: user.id,
      firmId: user.firmId,
      role,
      name: user.name,
      email: user.email,
      isActive: true,
      clientId: user.clientId ?? null,
    };
  }
}
