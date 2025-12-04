import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { ZodError, z } from 'zod';
import { errorHandler, asyncHandler } from '../../src/middleware/error-handler.js';
import {
  BaseError,
  AgentNotFoundError,
  ValidationError,
} from '../../src/utils/errors.js';

// Mock logger
vi.mock('../../src/utils/logger.js', () => ({
  Logger: class MockLogger {
    info = vi.fn();
    warn = vi.fn();
    error = vi.fn();
    debug = vi.fn();
    child = vi.fn(() => new MockLogger());
  },
}));

describe('errorHandler', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      path: '/test',
      method: 'GET',
      traceId: 'test-trace-id',
    } as Partial<Request>;

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    mockNext = vi.fn();
  });

  it('should handle ZodError with 400 status', () => {
    const schema = z.object({ name: z.string() });
    let zodError: ZodError;
    try {
      schema.parse({ name: 123 });
    } catch (e) {
      zodError = e as ZodError;
    }

    errorHandler(
      zodError!,
      mockReq as Request,
      mockRes as Response,
      mockNext
    );

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: expect.objectContaining({
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: expect.any(Array),
        traceId: 'test-trace-id',
        timestamp: expect.any(String),
      }),
    });
  });

  it('should handle BaseError with custom status code', () => {
    const error = new AgentNotFoundError('test-agent');

    errorHandler(
      error,
      mockReq as Request,
      mockRes as Response,
      mockNext
    );

    expect(mockRes.status).toHaveBeenCalledWith(404);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: expect.objectContaining({
        code: 'AGENT_NOT_FOUND',
        message: 'Agent not found: test-agent',
        traceId: 'test-trace-id',
      }),
    });
  });

  it('should handle ValidationError with 400 status', () => {
    const error = new ValidationError('Invalid input', { field: 'name' });

    errorHandler(
      error,
      mockReq as Request,
      mockRes as Response,
      mockNext
    );

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: expect.objectContaining({
        code: 'VALIDATION_ERROR',
        details: { field: 'name' },
      }),
    });
  });

  it('should handle generic Error with 500 status', () => {
    const error = new Error('Something went wrong');

    errorHandler(
      error,
      mockReq as Request,
      mockRes as Response,
      mockNext
    );

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: expect.objectContaining({
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong',
        traceId: 'test-trace-id',
      }),
    });
  });

  it('should handle unknown error types with 500 status', () => {
    const error = 'string error';

    errorHandler(
      error,
      mockReq as Request,
      mockRes as Response,
      mockNext
    );

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: expect.objectContaining({
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      }),
    });
  });

  it('should handle null error', () => {
    errorHandler(
      null,
      mockReq as Request,
      mockRes as Response,
      mockNext
    );

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: expect.objectContaining({
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      }),
    });
  });

  it('should include traceId when present on request', () => {
    const error = new Error('Test');

    errorHandler(
      error,
      mockReq as Request,
      mockRes as Response,
      mockNext
    );

    expect(mockRes.json).toHaveBeenCalledWith({
      error: expect.objectContaining({
        traceId: 'test-trace-id',
      }),
    });
  });

  it('should handle missing traceId', () => {
    const reqWithoutTrace = { ...mockReq };
    delete (reqWithoutTrace as any).traceId;

    const error = new Error('Test');

    errorHandler(
      error,
      reqWithoutTrace as Request,
      mockRes as Response,
      mockNext
    );

    expect(mockRes.json).toHaveBeenCalledWith({
      error: expect.objectContaining({
        traceId: undefined,
      }),
    });
  });
});

describe('asyncHandler', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {};
    mockRes = {
      json: vi.fn(),
    };
    mockNext = vi.fn();
  });

  it('should pass successful results through', async () => {
    const handler = asyncHandler(async (_req, res) => {
      res.json({ success: true });
    });

    handler(mockReq as Request, mockRes as Response, mockNext);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockRes.json).toHaveBeenCalledWith({ success: true });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should catch async errors and pass to next', async () => {
    const error = new Error('Async error');
    const handler = asyncHandler(async () => {
      throw error;
    });

    handler(mockReq as Request, mockRes as Response, mockNext);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockNext).toHaveBeenCalledWith(error);
  });

  it('should catch rejected promises', async () => {
    const error = new Error('Rejected');
    const handler = asyncHandler(() => Promise.reject(error));

    handler(mockReq as Request, mockRes as Response, mockNext);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockNext).toHaveBeenCalledWith(error);
  });
});
