import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../utils/logger.js';

declare global {
  namespace Express {
    interface Request {
      traceId: string;
      startTime: number;
    }
  }
}

const logger = new Logger('HTTP');

export const requestLogger: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  req.traceId = (req.headers['x-trace-id'] as string) || uuidv4();
  req.startTime = Date.now();

  res.setHeader('X-Trace-ID', req.traceId);

  logger.info('Request started', {
    traceId: req.traceId,
    method: req.method,
    path: req.path,
    query: Object.keys(req.query).length > 0 ? req.query : undefined,
    userAgent: req.headers['user-agent'],
  });

  res.on('finish', () => {
    const duration = Date.now() - req.startTime;

    const logData = {
      traceId: req.traceId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
    };

    if (res.statusCode >= 500) {
      logger.error('Request completed with server error', logData);
    } else if (res.statusCode >= 400) {
      logger.warn('Request completed with client error', logData);
    } else {
      logger.info('Request completed', logData);
    }
  });

  next();
};
