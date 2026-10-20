import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { publicFirmRole, publicPlatformRole } from "../authorization/domain/roles";
import { PrismaService } from "../prisma/prisma.service";
import { AuthUser, JwtPayload } from "../common/types";
import { UserRole } from "@prisma/client";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>("jwt.accessSecret") ?? "dev-access-secret",
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    if (payload.principal === "platform") {
      const user = await this.prisma.platformUser.findUnique({ where: { id: payload.sub } });
      if (!user || !user.isActive) {
        throw new UnauthorizedException("Account is not active");
      }
      return {
        id: user.id,
        email: user.email,
        role: UserRole.ADMIN,
        firmId: "",
        clientId: null,
        name: user.name,
        principal: "platform",
        platformRole: publicPlatformRole(user.role),
        isActive: user.isActive,
      };
    }
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.status !== "ACTIVE") {
      throw new UnauthorizedException("Account is not active");
    }
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      firmId: user.firmId,
      clientId: user.clientId,
      name: user.name,
      principal: "firm",
      firmRole: publicFirmRole(user.role),
      isActive: true,
    };
  }
}
