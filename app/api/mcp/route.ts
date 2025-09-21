import { NextRequest } from 'next/server';
import { z } from 'zod';
import { registry } from '@/lib/registry/store';
import { mcpClient } from '@/lib/mcp/client';
import type { RouteRequest, RouteResponse } from '@/lib/types';

// Schema for tool inputs
const DiscoverServicesSchema = z.object({
  capability: z.string().optional(),
  category: z.string().optional(),
  verified: z.boolean().optional()
});

const RouteRequestSchema = z.object({
  capability: z.string(),
  method: z.string(),
  params: z.any().optional(),
  preferredServer: z.string().optional()
});

const RegisterServerSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  category: z.string(),
  capabilities: z.array(z.string()),
  endpoint: z.string().url(),
  apiKey: z.string().optional()
});

export async function POST(request: NextRequest) {
  const body = await request.json();

  // Handle MCP protocol messages
  if (body.jsonrpc === '2.0') {
    return handleMCPMessage(body);
  }

  // Handle direct API calls
  return handleDirectAPI(body);
}

async function handleMCPMessage(message: any) {
  try {
    // Handle MCP JSON-RPC requests directly
    const { method, params, id } = message;

    switch (method) {
      case 'tools/list':
        return Response.json({
          jsonrpc: '2.0',
          id,
          result: {
            tools: [
              {
                name: 'discover_services',
                description: 'Discover available MCP services',
                inputSchema: {
                  type: 'object',
                  properties: {
                    capability: { type: 'string' },
                    category: { type: 'string' },
                    verified: { type: 'boolean' }
                  }
                }
              },
              {
                name: 'route_request',
                description: 'Route a request to the appropriate MCP server',
                inputSchema: {
                  type: 'object',
                  properties: {
                    capability: { type: 'string' },
                    method: { type: 'string' },
                    params: { type: 'object' },
                    preferredServer: { type: 'string' }
                  },
                  required: ['capability', 'method']
                }
              },
              {
                name: 'register_server',
                description: 'Register a new MCP server',
                inputSchema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    description: { type: 'string' },
                    category: { type: 'string' },
                    capabilities: { type: 'array', items: { type: 'string' } },
                    endpoint: { type: 'string' },
                    apiKey: { type: 'string' }
                  },
                  required: ['name', 'category', 'capabilities', 'endpoint']
                }
              },
              {
                name: 'list_all_servers',
                description: 'List all registered MCP servers',
                inputSchema: {
                  type: 'object',
                  properties: {}
                }
              }
            ]
          }
        });

      case 'tools/call':
        const { name, arguments: args } = params;

        switch (name) {
          case 'discover_services':
            const discoveryQuery = DiscoverServicesSchema.parse(args || {});
            const servers = await registry.discover(discoveryQuery);
            return Response.json({
              jsonrpc: '2.0',
              id,
              result: {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify(servers.map(s => ({
                      id: s.id,
                      name: s.name,
                      description: s.description,
                      category: s.category,
                      capabilities: s.capabilities,
                      verified: s.verified,
                      trustScore: s.trustScore
                    })), null, 2)
                  }
                ]
              }
            });

          case 'route_request':
            const routeReq = RouteRequestSchema.parse(args);
            const routeResponse = await handleRouteRequest(routeReq);
            return Response.json({
              jsonrpc: '2.0',
              id,
              result: {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify(routeResponse, null, 2)
                  }
                ]
              }
            });

          case 'register_server':
            const registerData = RegisterServerSchema.parse(args);
            const newServer = {
              id: `server-${Date.now()}`,
              ...registerData,
              verified: false,
              trustScore: 50,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await registry.register(newServer);
            return Response.json({
              jsonrpc: '2.0',
              id,
              result: {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify({ success: true, serverId: newServer.id })
                  }
                ]
              }
            });

          case 'list_all_servers':
            const allServers = await registry.getAllServers();
            return Response.json({
              jsonrpc: '2.0',
              id,
              result: {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify(allServers.map(s => ({
                      id: s.id,
                      name: s.name,
                      category: s.category,
                      capabilities: s.capabilities,
                      endpoint: s.endpoint,
                      verified: s.verified
                    })), null, 2)
                  }
                ]
              }
            });

          default:
            return Response.json({
              jsonrpc: '2.0',
              id,
              error: {
                code: -32601,
                message: `Unknown tool: ${name}`
              }
            });
        }

      default:
        return Response.json({
          jsonrpc: '2.0',
          id,
          error: {
            code: -32601,
            message: `Unknown method: ${method}`
          }
        });
    }
  } catch (error: any) {
    return Response.json({
      jsonrpc: '2.0',
      id: message.id,
      error: {
        code: -32000,
        message: error.message
      }
    }, { status: 500 });
  }
}

async function handleDirectAPI(body: any) {
  try {
    const { action, data } = body;

    switch (action) {
      case 'discover':
        const servers = await registry.discover(data || {});
        return Response.json({ servers });

      case 'route':
        const response = await handleRouteRequest(data);
        return Response.json(response);

      case 'register':
        const server = {
          id: `server-${Date.now()}`,
          ...data,
          verified: false,
          trustScore: 50,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        await registry.register(server);
        return Response.json({ success: true, serverId: server.id });

      default:
        return Response.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

async function handleRouteRequest(request: RouteRequest): Promise<RouteResponse> {
  const startTime = Date.now();

  // Find servers with the required capability
  const servers = await registry.discover({
    capability: request.capability
  });

  if (servers.length === 0) {
    throw new Error(`No servers available for capability: ${request.capability}`);
  }

  // Select server (prefer specified, otherwise use first)
  const selectedServer = request.preferredServer
    ? servers.find(s => s.id === request.preferredServer) || servers[0]
    : servers[0];

  try {
    // Route the request to the selected server
    const response = await mcpClient.callTool(
      selectedServer,
      request.method,
      request.params
    );

    return {
      serverId: selectedServer.id,
      serverName: selectedServer.name,
      response,
      executionTime: Date.now() - startTime
    };
  } catch (error: any) {
    console.error(`Error routing to server ${selectedServer.id}:`, error);
    throw new Error(`Failed to route request: ${error.message}`);
  }
}

export async function GET(request: NextRequest) {
  return Response.json({
    name: 'mcp-store-server',
    version: '1.0.0',
    description: 'Meta-layer MCP server for routing and discovery',
    capabilities: ['discover_services', 'route_request', 'register_server']
  });
}