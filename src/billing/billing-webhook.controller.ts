import { Controller, Headers, Post, RawBodyRequest, Req } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import type { Request } from "express";
import { BillingService } from "./billing.service";

@ApiExcludeController()
@SkipThrottle()
@Controller("billing/webhooks")
export class BillingWebhookController {
  constructor(private readonly billing: BillingService) {}

  @Post("stripe")
  stripe(@Req() request: RawBodyRequest<Request>, @Headers("stripe-signature") signature?: string) {
    const raw = request.rawBody ?? Buffer.from(JSON.stringify(request.body ?? {}));
    return this.billing.handleWebhook(raw, signature);
  }
}
