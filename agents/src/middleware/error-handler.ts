import type { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { isBaseError } from '../utils/errors.js';
import { Logger } from '../utils/logger.js';

interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
    traceId?: string | undefined;
    timestamp: string;
  };
}

const logger = new Logger('ErrorHandler');

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const traceId = (req as Request & { traceId?: string }).traceId;

  logger.error('Request failed', {
    error,
    traceId,
    path: req.path,
    method: req.method,
  });

  const response = mapErrorToResponse(error, traceId);
  res.status(response.status).json(response.body);
};

function mapErrorToResponse(
  error: unknown,
  traceId?: string
): { status: number; body: ErrorResponse } {
  const timestamp = new Date().toISOString();

  if (error instanceof ZodError) {
    return {
      status: 400,
      body: {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: error.errors,
          traceId,
          timestamp,
        },
      },
    };
  }

  if (isBaseError(error)) {
    return {
      status: error.statusCode,
      body: {
        error: {
          ...error.toJSON(),
          traceId,
          timestamp,
        } as ErrorResponse['error'],
      },
    };
  }

  if (error instanceof Error) {
    return {
      status: 500,
      body: {
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message,
          traceId,
          timestamp,
        },
      },
    };
  }

  return {
    status: 500,
    body: {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        traceId,
        timestamp,
      },
    },
  };
}

export function asyncHandler<T>(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<T>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
