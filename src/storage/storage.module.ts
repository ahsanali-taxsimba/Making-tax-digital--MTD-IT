import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { LocalStorageAdapter } from "./local-storage.adapter";
import { SupabaseStorageAdapter } from "./supabase-storage.adapter";
import { STORAGE_DRIVER, STORAGE_PORT, StoragePort } from "./storage.types";

@Global()
@Module({
  providers: [
    LocalStorageAdapter,
    SupabaseStorageAdapter,
    {
      provide: STORAGE_PORT,
      inject: [ConfigService, LocalStorageAdapter, SupabaseStorageAdapter],
      useFactory: (
        config: ConfigService,
        local: LocalStorageAdapter,
        supabase: SupabaseStorageAdapter,
      ): StoragePort => (config.get<string>("storage.driver") === STORAGE_DRIVER.SUPABASE ? supabase : local),
    },
  ],
  exports: [STORAGE_PORT],
})
export class StorageModule {}
