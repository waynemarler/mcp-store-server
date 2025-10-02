// Main authentication management for MCP servers

import type { AuthResult, ServerCredentials } from './types';
import { getServerCredentials, getSmitheryAuthUrl } from './credentials';
import type { MCPServerMetadata } from '@/lib/types';

/**
 * Generate authentication headers for a server
 */
export function generateAuthHeaders(credentials: ServerCredentials): Record<string, string> {
  const headers: Record<string, string> = {};

  if (!credentials || credentials.authType === 'none' || !credentials.apiKey) {
    return headers;
  }

  switch (credentials.authType) {
    case 'bearer':
      headers['Authorization'] = `Bearer ${credentials.apiKey}`;
      break;

    case 'api_key':
      headers['X-API-Key'] = credentials.apiKey;
      break;

    case 'basic':
      const encoded = Buffer.from(`api:${credentials.apiKey}`).toString('base64');
      headers['Authorization'] = `Basic ${encoded}`;
      break;
  }

  // Add any custom headers
  if (credentials.authHeaders) {
    Object.assign(headers, credentials.authHeaders);
  }

  return headers;
}

/**
 * Authenticate a server and get auth headers
 */
export function authenticateServer(server: MCPServerMetadata): AuthResult {
  try {
    // Get credentials for this server
    const credentials = getServerCredentials(
      server.id,
      server.name,
      server.endpoint
    );

    if (!credentials) {
      return {
        success: false,
        headers: {},
        error: 'No credentials found for server'
      };
    }

    // Generate auth headers
    const headers = generateAuthHeaders(credentials);

    return {
      success: true,
      headers
    };

  } catch (error: any) {
    console.error(`❌ Auth error for server ${server.name}:`, error);
    return {
      success: false,
      headers: {},
      error: error.message
    };
  }
}

/**
 * Enhance server metadata with auth information
 */
export function enhanceServerWithAuth(server: MCPServerMetadata): MCPServerMetadata {
  console.log(`🔍 ENHANCE AUTH DEBUG: ${server.name} (${server.id}) - Original endpoint: ${server.endpoint}`);

  // Check for Smithery URL-based auth first
  const smitheryUrl = getSmitheryAuthUrl(server.id);
  if (smitheryUrl) {
    console.log(`🔑 Using Smithery URL-based auth for ${server.name} - URL: ${smitheryUrl}`);
    return {
      ...server,
      endpoint: smitheryUrl
    };
  }

  // Fall back to credential-based auth
  console.log(`🔍 Checking credentials for ${server.name} (${server.id})`);
  const credentials = getServerCredentials(
    server.id,
    server.name,
    server.endpoint
  );

  if (!credentials || credentials.authType === 'none') {
    console.log(`❌ No credentials found for ${server.name} - returning unchanged`);
    return server;
  }

  console.log(`✅ Found credentials for ${server.name} - authType: ${credentials.authType}, hasApiKey: ${!!credentials.apiKey}`);
  // Add apiKey to server metadata so mcpClient.callTool() can use it
  return {
    ...server,
    apiKey: credentials.apiKey
  };
}

// getSmitheryAuthUrl is now imported from credentials.ts

/**
 * Check if a server requires authentication
 */
export function serverRequiresAuth(server: MCPServerMetadata): boolean {
  const credentials = getServerCredentials(
    server.id,
    server.name,
    server.endpoint
  );

  return credentials ? credentials.authType !== 'none' : false;
}

/**
 * Get auth debug info for a server
 */
export function getAuthDebugInfo(server: MCPServerMetadata) {
  const credentials = getServerCredentials(
    server.id,
    server.name,
    server.endpoint
  );

  return {
    serverId: server.id,
    serverName: server.name,
    endpoint: server.endpoint,
    hasCredentials: !!credentials,
    authType: credentials?.authType || 'unknown',
    hasApiKey: !!credentials?.apiKey,
    isActive: credentials?.isActive || false,
    lastUpdated: credentials?.lastUpdated
  };
}