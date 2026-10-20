import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable, map } from "rxjs";
import { ApiEnvelope } from "../types";

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiEnvelope<T>> {
  intercept(_context: ExecutionContext, next: CallHandler<T>): Observable<ApiEnvelope<T>> {
    return next.handle().pipe(
      map((data) => {
        if (data && typeof data === "object" && "data" in (data as object) && "error" in (data as object)) {
          return data as unknown as ApiEnvelope<T>;
        }
        return { data, error: null };
      }),
    );
  }
}
