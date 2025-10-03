// Proper MCP client using OAuth for Smithery servers
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { smitheryOAuth } from './smithery-oauth';
import type { MCPServerMetadata } from '@/lib/types';

export class OAuthMCPClient {
  private clients: Map<string, Client> = new Map();

  async getOrCreateClient(server: MCPServerMetadata): Promise<Client> {
    const clientKey = `${server.id}-${server.endpoint}`;

    if (this.clients.has(clientKey)) {
      return this.clients.get(clientKey)!;
    }

    console.log(`🔄 Creating OAuth MCP client for ${server.name} (${server.id})`);

    // Check if we have Smithery authentication
    if (!smitheryOAuth.isAuthenticated()) {
      throw new Error('Smithery OAuth required - please authenticate first');
    }

    // Create transport with shared Smithery OAuth
    const transport = new StreamableHTTPClientTransport(
      server.endpoint,
      { authProvider: smitheryOAuth }
    );

    // Create client
    const client = new Client({
      name: "mcp-store-server",
      version: "1.0.0"
    }, {
      capabilities: {}
    });

    try {
      console.log(`🔗 Connecting to ${server.name} with OAuth...`);
      await client.connect(transport);
      console.log(`✅ Connected to ${server.name} successfully`);

      this.clients.set(clientKey, client);
      return client;

    } catch (error: any) {
      console.error(`❌ Failed to connect to ${server.name}:`, error);

      // Check if this is an OAuth redirect requirement
      if (error.message.includes('Authorization redirect needed')) {
        console.log('🔄 OAuth authorization required for', server.name);
        // TODO: Handle OAuth redirect flow
      }

      throw error;
    }
  }

  async callTool(
    server: MCPServerMetadata,
    toolName: string,
    args: any
  ): Promise<any> {
    console.log(`🎯 OAuth CALL TOOL: ${toolName} on ${server.name} (${server.id})`);
    console.log(`📝 Tool arguments:`, JSON.stringify(args, null, 2));

    try {
      const client = await this.getOrCreateClient(server);

      const response = await client.callTool({
        name: toolName,
        arguments: args || {}
      });

      console.log(`✅ OAuth tool call successful: ${toolName}`);
      return response;

    } catch (error: any) {
      console.error(`❌ OAuth tool call failed: ${toolName}`, error);
      throw error;
    }
  }

  async listTools(server: MCPServerMetadata): Promise<any[]> {
    try {
      const client = await this.getOrCreateClient(server);
      const response = await client.listTools();
      return response.tools;
    } catch (error: any) {
      console.error(`❌ Error listing tools for ${server.name}:`, error);
      return [];
    }
  }

  async disconnect(serverId: string): Promise<void> {
    const clientKey = Array.from(this.clients.keys()).find(key => key.startsWith(serverId));
    if (clientKey) {
      const client = this.clients.get(clientKey);
      if (client) {
        await client.close();
        this.clients.delete(clientKey);
      }
    }
  }

  async disconnectAll(): Promise<void> {
    for (const [key, client] of this.clients) {
      await client.close();
    }
    this.clients.clear();
  }
}

// Export singleton for use across the application
export const oauthMCPClient = new OAuthMCPClient();