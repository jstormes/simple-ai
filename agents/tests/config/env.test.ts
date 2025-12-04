import { describe, it, expect } from 'vitest';

// Since the env module runs code at import time and caches values,
// we test the exported config object directly rather than trying to
// test different environment configurations which would require
// process isolation.

describe('env config', () => {
  // Import the already-loaded config
  // These tests verify the module loaded correctly with whatever env is set

  describe('envConfig structure', () => {
    it('should export envConfig with correct shape', async () => {
      const { envConfig } = await import('../../src/config/env.js');

      expect(envConfig).toHaveProperty('port');
      expect(envConfig).toHaveProperty('baseUrl');
      expect(envConfig).toHaveProperty('nodeEnv');
      expect(envConfig).toHaveProperty('agentConfigPath');
      expect(envConfig).toHaveProperty('defaultModel');
      expect(envConfig).toHaveProperty('defaultTemperature');
      expect(envConfig).toHaveProperty('defaultMaxTokens');
    });

    it('should have port as a number', async () => {
      const { envConfig } = await import('../../src/config/env.js');

      expect(typeof envConfig.port).toBe('number');
      expect(envConfig.port).toBeGreaterThan(0);
    });

    it('should have baseUrl as a string', async () => {
      const { envConfig } = await import('../../src/config/env.js');

      expect(typeof envConfig.baseUrl).toBe('string');
      expect(envConfig.baseUrl.length).toBeGreaterThan(0);
    });

    it('should have temperature between 0 and 2', async () => {
      const { envConfig } = await import('../../src/config/env.js');

      expect(envConfig.defaultTemperature).toBeGreaterThanOrEqual(0);
      expect(envConfig.defaultTemperature).toBeLessThanOrEqual(2);
    });

    it('should have positive maxTokens', async () => {
      const { envConfig } = await import('../../src/config/env.js');

      expect(envConfig.defaultMaxTokens).toBeGreaterThan(0);
    });
  });

  describe('loadEnvConfig function', () => {
    it('should be a function', async () => {
      const { loadEnvConfig } = await import('../../src/config/env.js');

      expect(typeof loadEnvConfig).toBe('function');
    });

    it('should return config object when called', async () => {
      const { loadEnvConfig } = await import('../../src/config/env.js');
      const config = loadEnvConfig();

      expect(config).toHaveProperty('port');
      expect(config).toHaveProperty('baseUrl');
    });
  });
});
