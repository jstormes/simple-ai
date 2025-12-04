import { config } from 'dotenv';

config();

export interface EnvConfig {
  port: number;
  baseUrl: string;
  nodeEnv: string;
  agentConfigPath: string;
  googleApiKey?: string | undefined;
  defaultModel: string;
  defaultTemperature: number;
  defaultMaxTokens: number;
}

function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value === undefined) {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a number`);
  }
  return parsed;
}

function getEnvFloat(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value === undefined) {
    return defaultValue;
  }
  const parsed = parseFloat(value);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a number`);
  }
  return parsed;
}

export function loadEnvConfig(): EnvConfig {
  const port = getEnvNumber('PORT', 8001);

  return {
    port,
    baseUrl: getEnvVar('BASE_URL', `http://localhost:${port}`),
    nodeEnv: getEnvVar('NODE_ENV', 'development'),
    agentConfigPath: getEnvVar('AGENT_CONFIG_PATH', './agents'),
    googleApiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    defaultModel: getEnvVar('DEFAULT_MODEL', 'gemini-2.0-flash'),
    defaultTemperature: getEnvFloat('DEFAULT_TEMPERATURE', 0.7),
    defaultMaxTokens: getEnvNumber('DEFAULT_MAX_TOKENS', 4096),
  };
}

export const envConfig = loadEnvConfig();
