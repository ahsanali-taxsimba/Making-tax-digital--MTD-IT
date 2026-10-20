import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Response } from "express";
import { BookkeepingError } from "../../bookkeeping/bookkeeping.errors";
import { CategorisationError } from "../../categorisation/categorisation.errors";
import { HmrcClientError } from "../../hmrc/client/hmrc-client.errors";
import { HmrcApiError } from "../../hmrc/hmrc.errors";
import { HmrcOAuthError } from "../../hmrc/oauth/hmrc-oauth.errors";
import { YapilyError } from "../../yapily/yapily.errors";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (
      exception instanceof HmrcOAuthError ||
      exception instanceof HmrcClientError ||
      exception instanceof YapilyError ||
      exception instanceof CategorisationError
    ) {
      const body = exception.getResponse();
      const message =
        typeof body === "object" && body && "message" in body
          ? String((body as { message: string }).message)
          : exception.message;
      response.status(exception.getStatus()).json({
        data: null,
        error: {
          code: exception.errorCode,
          errorCode: exception.errorCode,
          message,
          details: typeof body === "object" ? body : undefined,
        },
      });
      return;
    }

    if (exception instanceof BookkeepingError) {
      const body = exception.getResponse();
      const message =
        typeof body === "object" && body && "message" in body
          ? String((body as { message: string }).message)
          : exception.message;
      response.status(exception.getStatus()).json({
        data: null,
        error: {
          code: exception.code,
          message,
          details: typeof body === "object" ? body : undefined,
        },
      });
      return;
    }

    if (exception instanceof HmrcApiError) {
      response.status(exception.statusCode >= 400 ? exception.statusCode : HttpStatus.BAD_GATEWAY).json({
        data: null,
        error: {
          code: exception.code,
          message: exception.message,
          details: exception.details,
        },
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const message =
        typeof body === "string" ? body : ((body as { message?: string | string[] }).message ?? exception.message);
      response.status(status).json({
        data: null,
        error: {
          code: exception.name.replace("Exception", "").toUpperCase() || "HTTP_ERROR",
          message: Array.isArray(message) ? message.join("; ") : message,
          details: typeof body === "object" ? body : undefined,
        },
      });
      return;
    }

    this.logger.error(exception instanceof Error ? exception.stack : exception);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      data: null,
      error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
    });
  }
}
