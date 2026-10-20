import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { PrismaService } from "../prisma/prisma.service";

@ApiTags("health")
@SkipThrottle()
@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: "Legacy liveness alias" })
  liveAlias() {
    return this.live();
  }

  @Get("live")
  @ApiOperation({ summary: "Kubernetes liveness: process is up (no database check)" })
  live() {
    return { status: "live", service: "mtd-it-api" };
  }

  @Get("ready")
  @ApiOperation({ summary: "Kubernetes readiness: database is reachable" })
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({ status: "not_ready", service: "mtd-it-api" });
    }
    return { status: "ready", service: "mtd-it-api" };
  }
}
