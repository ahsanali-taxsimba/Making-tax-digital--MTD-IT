import { Global, Module } from "@nestjs/common";
import { FraudPreventionStore } from "./fraud-prevention.store";

@Global()
@Module({
  providers: [FraudPreventionStore],
  exports: [FraudPreventionStore],
})
export class FraudPreventionModule {}
