import { Controller, ForbiddenException, Get, Header, Headers, Query } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { LOGICAL_SERVICES } from "./service-catalog";
import { MetricsService } from "./metrics.service";

@ApiTags("metrics")
@SkipThrottle()
@Controller("metrics")
export class MetricsController {
  constructor(
    private readonly metrics: MetricsService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  @Header("Content-Type", "text/plain; version=0.0.4")
  @ApiOperation({ summary: "Prometheus metrics for every logical MTD service" })
  scrape(@Headers("authorization") authorization?: string, @Headers("x-metrics-token") headerToken?: string, @Query("token") queryToken?: string) {
    this.assertMetricsAccess(authorization, headerToken, queryToken);
    for (const service of LOGICAL_SERVICES) {
      this.metrics.inc("mtd_service_up", { service }, 0);
    }
    return this.metrics.render();
  }

  private assertMetricsAccess(authorization?: string, headerToken?: string, queryToken?: string) {
    const expected = this.config.get<string>("metricsToken") ?? "";
    const nodeEnv = this.config.get<string>("nodeEnv") ?? "development";
    if (!expected) {
      if (nodeEnv === "production") {
        throw new ForbiddenException("Metrics are disabled until METRICS_TOKEN is set");
      }
      return;
    }
    const bearer = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
    const provided = headerToken || bearer || queryToken || "";
    if (provided !== expected) {
      throw new ForbiddenException("Invalid metrics token");
    }
  }
}
