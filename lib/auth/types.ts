// Authentication types for MCP servers

export interface ServerCredentials {
  serverId: string;
  serverName: string;
  apiKey?: string;
  authType: 'bearer' | 'api_key' | 'basic' | 'none';
  authHeaders?: Record<string, string>;
  endpoint?: string;
  lastUpdated: Date;
  isActive: boolean;
}

export interface AuthProvider {
  name: string;
  baseUrl: string;
  authType: 'bearer' | 'api_key' | 'basic';
  keyEnvVar: string;
  servers: string[]; // Server IDs that use this provider
}

export interface AuthResult {
  success: boolean;
  headers: Record<string, string>;
  error?: string;
}

export interface AuthConfig {
  providers: AuthProvider[];
  fallback: {
    retryAttempts: number;
    retryDelay: number;
  };
}