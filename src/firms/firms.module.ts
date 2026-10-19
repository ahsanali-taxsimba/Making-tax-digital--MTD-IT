import { Module } from "@nestjs/common";
import { FirmsController } from "./firms.controller";
import { FirmsService } from "./firms.service";

@Module({
  controllers: [FirmsController],
  providers: [FirmsService],
})
export class FirmsModule {}
