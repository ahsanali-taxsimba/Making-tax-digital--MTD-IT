import { Controller, Get, Header } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { LOGICAL_SERVICES } from "./service-catalog";
import { MetricsService } from "./metrics.service";

@ApiTags("metrics")
@SkipThrottle()
@Controller("metrics")
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  @Header("Content-Type", "text/plain; version=0.0.4")
  @ApiOperation({ summary: "Prometheus metrics for every logical MTD service" })
  scrape() {
    for (const service of LOGICAL_SERVICES) {
      this.metrics.inc("mtd_service_up", { service }, 0);
    }
    return this.metrics.render();
  }
}
