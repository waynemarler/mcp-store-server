import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import type { MCPServerMetadata } from '@/lib/types';

export class MCPClient {
  private clients: Map<string, Client> = new Map();
  private initializedServers: Set<string> = new Set();
  private sessionStore: Map<string, string> = new Map();

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
    console.log(`🎯 CALLING TOOL: ${toolName} on ${server.name} (${server.id}) - Endpoint: ${server.endpoint}`);
    try {
      // Determine if this is a Smithery server by checking the endpoint
      const isSmitheryServer = server.endpoint.includes('server.smithery.ai');
      console.log(`🔍 Server type: ${isSmitheryServer ? 'Smithery' : 'Regular'} - Args:`, JSON.stringify(args));

      // Always initialize Smithery servers just-in-time (sessions expire quickly)
      if (isSmitheryServer) {
        console.log(`🔄 FRESH SESSION: Initializing LibraLM for immediate tool call`);
        await this.initializeSmitheryServer(server);
        this.initializedServers.add(server.id);
      }

      // For HTTP-based MCP servers, use direct HTTP calls
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(server.apiKey ? { 'Authorization': `Bearer ${server.apiKey}` } : {})
      };

      // Add required Accept headers for Smithery servers
      if (isSmitheryServer) {
        headers['Accept'] = 'application/json, text/event-stream'; // LibraLM requires SSE support

        // Add session ID if we have one for this server
        const sessionId = this.sessionStore.get(server.id);
        if (sessionId) {
          headers['mcp-session-id'] = sessionId;
        }
      }

      console.log(`🚀 MAKING FETCH REQUEST to ${server.endpoint}`);
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
        }),
        signal: AbortSignal.timeout(45000) // 45 second timeout
      });

      console.log(`📡 FETCH RESPONSE: ${response.status} ${response.statusText}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Capture session ID from response headers for Smithery servers
      if (isSmitheryServer) {
        const sessionId = response.headers.get('mcp-session-id');
        if (sessionId) {
          this.sessionStore.set(server.id, sessionId);
          console.log(`🔗 Captured session ID for ${server.name}: ${sessionId}`);
        }
      }

      // Handle Server-Sent Events format for Smithery servers
      if (isSmitheryServer && response.headers.get('content-type')?.includes('text/event-stream')) {
        console.log(`🌊 READING SSE RESPONSE STREAM - Content-Type: ${response.headers.get('content-type')}`);

        // LibraLM keeps SSE connection open indefinitely, so we need to read incrementally
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body reader available');
        }

        const decoder = new TextDecoder();
        let text = '';
        let complete = false;

        // Read stream with timeout per chunk
        const startTime = Date.now();
        while (!complete && (Date.now() - startTime) < 25000) { // 25 second total timeout
          const chunkPromise = reader.read();
          const timeoutPromise = new Promise<{done: boolean, value?: Uint8Array}>((_, reject) =>
            setTimeout(() => reject(new Error('Chunk read timeout')), 5000) // 5s per chunk
          );

          try {
            const { done, value } = await Promise.race([chunkPromise, timeoutPromise]);

            if (done) {
              complete = true;
              break;
            }

            if (value) {
              const chunk = decoder.decode(value, { stream: true });
              text += chunk;

              // Check if we have a complete JSON response
              if (text.includes('{"jsonrpc"') && text.includes('}')) {
                console.log(`📦 FOUND COMPLETE JSON in stream - stopping read`);
                break;
              }

              // Check if we have complete SSE data
              if (text.includes('data: {') && text.includes('}')) {
                console.log(`📦 FOUND COMPLETE SSE DATA in stream - stopping read`);
                break;
              }
            }
          } catch (e: any) {
            if (e.message === 'Chunk read timeout') {
              console.log(`⏰ Chunk timeout - using partial response. Length: ${text.length}`);
              break;
            }
            throw e;
          }
        }

        reader.releaseLock();
        console.log(`📖 SSE RESPONSE TEXT LENGTH: ${text.length}`);
        console.log(`📄 SSE RESPONSE PREVIEW: ${text.substring(0, 200)}...`);

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
          console.log(`⚠️ NO SSE DATA FOUND - Trying direct JSON parse. Full text: ${text}`);
          // Fallback: try parsing the entire response as JSON
          try {
            const result = JSON.parse(text);
            if (result.error) {
              throw new Error(`MCP Error: ${result.error.message}`);
            }
            console.log(`✅ DIRECT JSON PARSE SUCCESS - Tool: ${toolName}, Server: ${server.name}`);
            return result.result;
          } catch (e) {
            throw new Error(`No valid SSE data or JSON found in response: ${text.substring(0, 500)}`);
          }
        }

        const result = JSON.parse(jsonData);

        if (result.error) {
          throw new Error(`MCP Error: ${result.error.message}`);
        }

        console.log(`✅ SSE RESPONSE SUCCESS - Tool: ${toolName}, Server: ${server.name}`);
        return result.result;
      } else {
        // Standard JSON response
        console.log(`📄 PARSING JSON RESPONSE - Tool: ${toolName}, Server: ${server.name}`);
        const result = await response.json();

        if (result.error) {
          console.error(`❌ MCP ERROR in response:`, result.error);
          throw new Error(`MCP Error: ${result.error.message}`);
        }

        console.log(`✅ JSON RESPONSE SUCCESS - Tool: ${toolName}, Server: ${server.name}`);
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

  private async initializeSmitheryServer(server: MCPServerMetadata): Promise<void> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream'
    };

    const response = await fetch(server.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Math.floor(Math.random() * 1000),
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'mcp-store-server',
            version: '1.0.0'
          }
        }
      }),
      signal: AbortSignal.timeout(30000) // 30 second timeout for initialization
    });

    if (!response.ok) {
      throw new Error(`Failed to initialize server ${server.name}: HTTP ${response.status}`);
    }

    // Capture session ID from initialization response
    const sessionId = response.headers.get('mcp-session-id');
    if (sessionId) {
      this.sessionStore.set(server.id, sessionId);
      console.log(`🔗 Stored session ID for ${server.name}: ${sessionId}`);
    }

    // For SSE responses, just ensure we get a successful response
    if (response.headers.get('content-type')?.includes('text/event-stream')) {
      await response.text(); // Consume the response
    } else {
      const result = await response.json();
      if (result.error) {
        throw new Error(`Failed to initialize server ${server.name}: ${result.error.message}`);
      }
    }

    console.log(`✅ Initialized Smithery server: ${server.name}`);
  }
}

// Singleton instance
export const mcpClient = new MCPClient();