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
    try {
      // Determine if this is a Smithery server by checking the endpoint
      const isSmitheryServer = server.endpoint.includes('server.smithery.ai');

      // For HTTP-based MCP servers, use direct HTTP calls
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(server.apiKey ? { 'Authorization': `Bearer ${server.apiKey}` } : {})
      };

      // Add required Accept headers for Smithery servers
      if (isSmitheryServer) {
        headers['Accept'] = 'application/json, text/event-stream';
      }

      const response = await fetch(server.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Math.floor(Math.random() * 1000),
          method: 'tools/call',
          params: {
            name: toolName,
            arguments: args
          }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Handle Server-Sent Events format for Smithery servers
      if (isSmitheryServer && response.headers.get('content-type')?.includes('text/event-stream')) {
        const text = await response.text();

        // Parse SSE format: "event: message\ndata: {json}\n\n"
        const lines = text.trim().split('\n');
        let jsonData = '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            jsonData = line.substring(6); // Remove "data: " prefix
            break;
          }
        }

        if (!jsonData) {
          throw new Error('No data found in SSE response');
        }

        const result = JSON.parse(jsonData);

        if (result.error) {
          throw new Error(`MCP Error: ${result.error.message}`);
        }

        return result.result;
      } else {
        // Standard JSON response
        const result = await response.json();

        if (result.error) {
          throw new Error(`MCP Error: ${result.error.message}`);
        }

        return result.result;
      }
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