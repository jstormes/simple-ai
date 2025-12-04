import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger } from '../../src/utils/logger.js';

describe('Logger', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create logger with context', () => {
      const logger = new Logger('TestContext');
      logger.info('test');

      expect(consoleLogSpy).toHaveBeenCalled();
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.context).toBe('[TestContext]');
    });

    it('should default to info level', () => {
      const logger = new Logger('Test');

      logger.debug('debug message');
      expect(consoleLogSpy).not.toHaveBeenCalled();

      logger.info('info message');
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should respect custom min level', () => {
      const logger = new Logger('Test', 'warn');

      logger.info('info message');
      expect(consoleLogSpy).not.toHaveBeenCalled();

      logger.warn('warn message');
      expect(consoleWarnSpy).toHaveBeenCalled();
    });
  });

  describe('log levels', () => {
    it('should log debug messages when level is debug', () => {
      const logger = new Logger('Test', 'debug');
      logger.debug('debug message');

      expect(consoleLogSpy).toHaveBeenCalled();
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.level).toBe('debug');
      expect(output.message).toBe('debug message');
    });

    it('should log info messages', () => {
      const logger = new Logger('Test', 'info');
      logger.info('info message');

      expect(consoleLogSpy).toHaveBeenCalled();
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.level).toBe('info');
    });

    it('should log warn messages to console.warn', () => {
      const logger = new Logger('Test', 'info');
      logger.warn('warn message');

      expect(consoleWarnSpy).toHaveBeenCalled();
      const output = JSON.parse(consoleWarnSpy.mock.calls[0][0] as string);
      expect(output.level).toBe('warn');
    });

    it('should log error messages to console.error', () => {
      const logger = new Logger('Test', 'info');
      logger.error('error message');

      expect(consoleErrorSpy).toHaveBeenCalled();
      const output = JSON.parse(consoleErrorSpy.mock.calls[0][0] as string);
      expect(output.level).toBe('error');
    });
  });

  describe('log filtering', () => {
    it('should filter debug when level is info', () => {
      const logger = new Logger('Test', 'info');
      logger.debug('filtered');
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should filter info when level is warn', () => {
      const logger = new Logger('Test', 'warn');
      logger.info('filtered');
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should filter warn when level is error', () => {
      const logger = new Logger('Test', 'error');
      logger.warn('filtered');
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should always log at error level when level is error', () => {
      const logger = new Logger('Test', 'error');
      logger.error('not filtered');
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('log output format', () => {
    it('should include timestamp', () => {
      const logger = new Logger('Test');
      logger.info('message');

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.timestamp).toBeDefined();
      expect(() => new Date(output.timestamp)).not.toThrow();
    });

    it('should include context in brackets', () => {
      const logger = new Logger('MyModule');
      logger.info('message');

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.context).toBe('[MyModule]');
    });

    it('should include data when provided', () => {
      const logger = new Logger('Test');
      logger.info('message', { key: 'value', count: 42 });

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.data).toEqual({ key: 'value', count: 42 });
    });

    it('should not include data key when not provided', () => {
      const logger = new Logger('Test');
      logger.info('message');

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output).not.toHaveProperty('data');
    });
  });

  describe('error formatting', () => {
    it('should format Error objects in data', () => {
      const logger = new Logger('Test');
      const error = new Error('Test error');
      logger.error('failed', { error });

      const output = JSON.parse(consoleErrorSpy.mock.calls[0][0] as string);
      expect(output.data.error).toEqual({
        name: 'Error',
        message: 'Test error',
        stack: expect.any(String),
      });
    });

    it('should format nested error causes', () => {
      const logger = new Logger('Test');
      const cause = new Error('Root cause');
      const error = new Error('Wrapper error', { cause });
      logger.error('failed', { error });

      const output = JSON.parse(consoleErrorSpy.mock.calls[0][0] as string);
      expect(output.data.error.cause).toEqual({
        name: 'Error',
        message: 'Root cause',
        stack: expect.any(String),
      });
    });

    it('should handle non-Error values in error field', () => {
      const logger = new Logger('Test');
      logger.error('failed', { error: 'string error' });

      const output = JSON.parse(consoleErrorSpy.mock.calls[0][0] as string);
      expect(output.data.error).toEqual({ value: 'string error' });
    });

    it('should handle null error', () => {
      const logger = new Logger('Test');
      logger.error('failed', { error: null });

      const output = JSON.parse(consoleErrorSpy.mock.calls[0][0] as string);
      // null is falsy, so formatError is not called and error remains null
      expect(output.data.error).toBeNull();
    });
  });

  describe('child logger', () => {
    it('should create child with nested context', () => {
      const logger = new Logger('Parent');
      const child = logger.child('Child');
      child.info('message');

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.context).toBe('[Parent:Child]');
    });

    it('should inherit log level from parent', () => {
      const logger = new Logger('Parent', 'warn');
      const child = logger.child('Child');

      child.info('filtered');
      expect(consoleLogSpy).not.toHaveBeenCalled();

      child.warn('not filtered');
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('should allow multiple levels of nesting', () => {
      const logger = new Logger('A');
      const child1 = logger.child('B');
      const child2 = child1.child('C');
      child2.info('message');

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.context).toBe('[A:B:C]');
    });
  });
});
