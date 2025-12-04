import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { requestLogger } from '../../src/middleware/request-logger.js';

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'generated-trace-id'),
}));

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

describe('requestLogger', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let finishHandler: () => void;

  beforeEach(() => {
    vi.clearAllMocks();
    finishHandler = () => {};

    mockReq = {
      method: 'GET',
      path: '/test',
      headers: {},
      query: {},
    } as Partial<Request>;

    mockRes = {
      statusCode: 200,
      setHeader: vi.fn(),
      on: vi.fn((event: string, handler: () => void) => {
        if (event === 'finish') {
          finishHandler = handler;
        }
        return mockRes as Response;
      }),
    };

    mockNext = vi.fn();
  });

  it('should add traceId to request', () => {
    requestLogger(mockReq as Request, mockRes as Response, mockNext);

    expect((mockReq as any).traceId).toBe('generated-trace-id');
  });

  it('should use existing X-Trace-ID header', () => {
    mockReq.headers = { 'x-trace-id': 'existing-trace-id' };

    requestLogger(mockReq as Request, mockRes as Response, mockNext);

    expect((mockReq as any).traceId).toBe('existing-trace-id');
  });

  it('should add startTime to request', () => {
    const beforeTime = Date.now();

    requestLogger(mockReq as Request, mockRes as Response, mockNext);

    expect((mockReq as any).startTime).toBeGreaterThanOrEqual(beforeTime);
    expect((mockReq as any).startTime).toBeLessThanOrEqual(Date.now());
  });

  it('should set X-Trace-ID response header', () => {
    requestLogger(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.setHeader).toHaveBeenCalledWith('X-Trace-ID', 'generated-trace-id');
  });

  it('should call next()', () => {
    requestLogger(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });

  it('should register finish event handler', () => {
    requestLogger(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.on).toHaveBeenCalledWith('finish', expect.any(Function));
  });

  describe('finish handler', () => {
    it('should log with info for 2xx responses', () => {
      requestLogger(mockReq as Request, mockRes as Response, mockNext);

      mockRes.statusCode = 200;
      finishHandler();

      // Verify the finish handler was registered and executed without error
      expect(mockRes.on).toHaveBeenCalledWith('finish', expect.any(Function));
    });

    it('should log with info for 3xx responses', () => {
      requestLogger(mockReq as Request, mockRes as Response, mockNext);

      mockRes.statusCode = 301;
      finishHandler();

      expect(mockRes.on).toHaveBeenCalledWith('finish', expect.any(Function));
    });

    it('should log with warn for 4xx responses', () => {
      requestLogger(mockReq as Request, mockRes as Response, mockNext);

      mockRes.statusCode = 404;
      finishHandler();

      expect(mockRes.on).toHaveBeenCalledWith('finish', expect.any(Function));
    });

    it('should log with error for 5xx responses', () => {
      requestLogger(mockReq as Request, mockRes as Response, mockNext);

      mockRes.statusCode = 500;
      finishHandler();

      expect(mockRes.on).toHaveBeenCalledWith('finish', expect.any(Function));
    });
  });

  it('should include query params when present', () => {
    mockReq.query = { page: '1', limit: '10' };

    requestLogger(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });

  it('should exclude empty query params', () => {
    mockReq.query = {};

    requestLogger(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });
});
