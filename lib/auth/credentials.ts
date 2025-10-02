// Credential storage and retrieval for MCP server authentication

import type { ServerCredentials, AuthProvider } from './types';

// Known auth providers and their server mappings
const AUTH_PROVIDERS: AuthProvider[] = [
  {
    name: 'LibraLM',
    baseUrl: 'server.smithery.ai/@libralm-ai',
    authType: 'bearer',
    keyEnvVar: 'LIBRALM_API_KEY',
    servers: ['ext_1588'] // LibraLM Book Summaries server ID
  },
  // REMOVED: Generic Smithery provider was too broad and matching all server.smithery.ai servers
  // This was causing Google Books to incorrectly get SMITHERY_API_KEY
  // Individual Smithery servers should have specific providers (like LibraLM above)
];

// Smithery URL-based auth configurations
const SMITHERY_AUTH_URLS: Record<string, string> = {
  'ext_1588': 'https://server.smithery.ai/@libralm-ai/libralm_mcp_server/mcp?api_key=93ad3877-ed8d-4a21-a662-673c6ca7a970&profile=back-otter-YNMNuN'
};

// In-memory credential cache
const credentialCache = new Map<string, ServerCredentials>();

/**
 * Get credentials for a specific server
 */
export function getServerCredentials(serverId: string, serverName?: string, endpoint?: string): ServerCredentials | null {
  // Check cache first
  if (credentialCache.has(serverId)) {
    return credentialCache.get(serverId)!;
  }

  // Find matching auth provider
  const provider = AUTH_PROVIDERS.find(p =>
    p.servers.includes(serverId) ||
    (endpoint && endpoint.includes(p.baseUrl))
  );

  if (!provider) {
    // No auth required - return none auth type
    const creds: ServerCredentials = {
      serverId,
      serverName: serverName || serverId,
      authType: 'none',
      lastUpdated: new Date(),
      isActive: true
    };
    credentialCache.set(serverId, creds);
    return creds;
  }

  // Get API key from environment
  const apiKey = process.env[provider.keyEnvVar];

  if (!apiKey) {
    console.warn(`⚠️ Missing API key for ${provider.name} (${provider.keyEnvVar})`);
    return null;
  }

  // Create credentials
  const credentials: ServerCredentials = {
    serverId,
    serverName: serverName || serverId,
    apiKey,
    authType: provider.authType,
    endpoint,
    lastUpdated: new Date(),
    isActive: true
  };

  // Cache credentials
  credentialCache.set(serverId, credentials);

  console.log(`🔑 Loaded credentials for ${provider.name} server: ${serverName}`);
  return credentials;
}

/**
 * Get all registered auth providers
 */
export function getAuthProviders(): AuthProvider[] {
  return [...AUTH_PROVIDERS];
}

/**
 * Add or update server credentials manually
 */
export function setServerCredentials(credentials: ServerCredentials): void {
  credentialCache.set(credentials.serverId, credentials);
  console.log(`🔑 Updated credentials for server: ${credentials.serverName}`);
}

/**
 * Remove server credentials
 */
export function removeServerCredentials(serverId: string): boolean {
  const removed = credentialCache.delete(serverId);
  if (removed) {
    console.log(`🗑️ Removed credentials for server: ${serverId}`);
  }
  return removed;
}

/**
 * Clear all cached credentials
 */
export function clearCredentialCache(): void {
  const count = credentialCache.size;
  credentialCache.clear();
  console.log(`🧹 Cleared ${count} cached credentials`);
}

/**
 * Get credential cache stats
 */
export function getCredentialStats() {
  const cached = credentialCache.size;
  const withApiKeys = Array.from(credentialCache.values()).filter(c => c.apiKey).length;

  return {
    totalCached: cached,
    withApiKeys,
    withoutApiKeys: cached - withApiKeys,
    providers: AUTH_PROVIDERS.length
  };
}

/**
 * Get Smithery auth URL for a server ID
 */
export function getSmitheryAuthUrl(serverId: string): string | null {
  return SMITHERY_AUTH_URLS[serverId] || null;
}

// Export for external access
export { SMITHERY_AUTH_URLS };