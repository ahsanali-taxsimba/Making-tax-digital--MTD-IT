import { Injectable, NestMiddleware } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";
import { fraudContextFromRequest, FraudPreventionStore } from "./fraud-prevention.store";

@Injectable()
export class FraudPreventionMiddleware implements NestMiddleware {
  constructor(private readonly store: FraudPreventionStore) {}

  use(req: Request, _res: Response, next: NextFunction): void {
    this.store.run(fraudContextFromRequest(req), next);
  }
}
