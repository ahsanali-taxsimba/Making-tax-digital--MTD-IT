export const STORAGE_DRIVER = {
  LOCAL: "local",
  SUPABASE: "supabase",
} as const;

export type StorageDriver = (typeof STORAGE_DRIVER)[keyof typeof STORAGE_DRIVER];

export interface StoredObject {
  key: string;
  sizeBytes: number;
  mimeType: string;
}

export interface StoragePort {
  readonly driver: StorageDriver;
  put(key: string, body: Buffer, mimeType: string): Promise<StoredObject>;
  get(key: string): Promise<{ body: Buffer; mimeType: string }>;
  ready(): Promise<boolean>;
}

export const STORAGE_PORT = Symbol("STORAGE_PORT");
