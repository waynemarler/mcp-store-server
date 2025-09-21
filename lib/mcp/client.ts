import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import type { MCPServerMetadata } from '@/lib/types';

export class MCPClient {
  private clients: Map<string, Client> = new Map();

  async getOrCreateClient(server: MCPServerMetadata): Promise<Client> {
    if (this.clients.has(server.id)) {
      return this.clients.get(server.id)!;
    }

    const client = await this.createClient(server);
    this.clients.set(server.id, client);
    return client;
  }

  private async createClient(server: MCPServerMetadata): Promise<Client> {
    const client = new Client(
      {
        name: `mcp-store-client-${server.id}`,
        version: '1.0.0',
      },
      {
        capabilities: {}
      }
    );

    // Create SSE transport
    const transport = new SSEClientTransport(
      new URL(server.endpoint)
    );

    await client.connect(transport);
    return client;
  }

  async callTool(
    server: MCPServerMetadata,
    toolName: string,
    args: any
  ): Promise<any> {
    const client = await this.getOrCreateClient(server);

    try {
      const result = await client.callTool({ name: toolName, arguments: args });
      return result;
    } catch (error: any) {
      console.error(`Error calling tool ${toolName} on server ${server.id}:`, error);
      throw new Error(`Failed to call tool: ${error.message}`);
    }
  }

  async listTools(server: MCPServerMetadata): Promise<any[]> {
    const client = await this.getOrCreateClient(server);

    try {
      const response = await client.listTools();
      return response.tools;
    } catch (error: any) {
      console.error(`Error listing tools on server ${server.id}:`, error);
      return [];
    }
  }

  async disconnect(serverId: string): Promise<void> {
    const client = this.clients.get(serverId);
    if (client) {
      await client.close();
      this.clients.delete(serverId);
    }
  }

  async disconnectAll(): Promise<void> {
    for (const [serverId] of this.clients) {
      await this.disconnect(serverId);
    }
  }
}

// Singleton instance
export const mcpClient = new MCPClient();