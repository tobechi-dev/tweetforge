import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { DiscordService } from '../../discord/discord.service';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);
  private discordService?: DiscordService;

  constructor(discordService?: DiscordService) {
    this.discordService = discordService;
  }

  async catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | object = 'Internal server error';
    let stack: string | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      message = typeof exceptionResponse === 'string'
        ? exceptionResponse
        : (exceptionResponse as any).message || exceptionResponse;
      stack = exception.stack;
    } else if (exception instanceof Error) {
      message = exception.message;
      stack = exception.stack;
    }

    this.logger.error(
      `${request.method} ${request.url} → ${status}: ${JSON.stringify(message)}`,
      stack,
    );

    // Send to Discord if configured (async, don't await)
    if (this.discordService) {
      this.discordService
        .sendErrorNotification(
          exception instanceof Error ? exception : new Error(JSON.stringify(exception)),
          `${request.method} ${request.url}`,
        )
        .catch((err) => {
          this.logger.error('Failed to send error to Discord', err);
        });
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
    });
  }
}
