import { UserRole } from "@prisma/client";

export type ApiSuccess<T> = { data: T; error: null };
export type ApiFailure = { data: null; error: { code: string; message: string; details?: unknown } };
export type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure;

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  firmId: string;
  clientId: string | null;
  name: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  firmId: string;
  clientId: string | null;
}
