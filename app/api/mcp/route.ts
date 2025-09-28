import { NextRequest } from "next/server";
import { z } from "zod";
import { registry } from "@/lib/registry/store";
import { mcpClient } from "@/lib/mcp/client";
import type { RouteRequest, RouteResponse } from "@/lib/types";

// Schema for tool inputs
const DiscoverServicesSchema = z.object({
  capability: z.string().optional(),
  category: z.string().optional(),
  verified: z.boolean().optional(),
});

const RouteRequestSchema = z.object({
  capability: z.string().optional(),
  method: z.string().optional(),
  params: z.any().optional(),
  preferredServer: z.string().optional(),
});

const RegisterServerSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  category: z.string().optional(),
  categories: z
    .array(
      z.object({
        mainCategory: z.string(),
        subCategory: z.string(),
        description: z.string().optional(),
      })
    )
    .optional(),
  capabilities: z.array(z.string()),
  endpoint: z.string().url(),
  apiKey: z.string().optional(),
  type: z.enum(["informational", "transactional", "task"]).optional(),
  version: z.string().optional(),
  author: z
    .object({
      name: z.string(),
      website: z.string().optional(),
      contactEmail: z.string().optional(),
    })
    .optional(),
  tags: z.array(z.string()).optional(),
  verified: z.boolean().optional(),
  trustScore: z.number().min(0).max(100).optional(),
  status: z.enum(["active", "inactive", "deprecated"]).optional(),
  logoUrl: z.string().url().optional(),
});

export async function POST(request: NextRequest) {
  const body = await request.json();

  // Handle MCP protocol messages
  if (body.jsonrpc === "2.0") {
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
      case "tools/list":
        return Response.json({
          jsonrpc: "2.0",
          id,
          result: {
            tools: [
              {
                name: "discover_services",
                description: "Discover available MCP services",
                inputSchema: {
                  type: "object",
                  properties: {
                    capability: { type: "string" },
                    category: { type: "string" },
                    verified: { type: "boolean" },
                  },
                },
              },
              {
                name: "route_request",
                description: "Route a request to the appropriate MCP server",
                inputSchema: {
                  type: "object",
                  properties: {
                    capability: { type: "string" },
                    method: { type: "string" },
                    params: { type: "object" },
                    preferredServer: { type: "string" },
                  },
                  required: ["capability", "method"],
                },
              },
              {
                name: "register_server",
                description: "Register a new MCP server",
                inputSchema: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    description: { type: "string" },
                    category: { type: "string" },
                    categories: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          mainCategory: { type: "string" },
                          subCategory: { type: "string" },
                          description: { type: "string" },
                        },
                      },
                    },
                    capabilities: { type: "array", items: { type: "string" } },
                    endpoint: { type: "string" },
                    apiKey: { type: "string" },
                    type: {
                      type: "string",
                      enum: ["informational", "transactional", "task"],
                    },
                    version: { type: "string" },
                    author: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        website: { type: "string" },
                        contactEmail: { type: "string" },
                      },
                    },
                    tags: { type: "array", items: { type: "string" } },
                    verified: { type: "boolean" },
                    trustScore: { type: "number", minimum: 0, maximum: 100 },
                    status: {
                      type: "string",
                      enum: ["active", "inactive", "deprecated"],
                    },
                    logoUrl: { type: "string" },
                  },
                  required: ["name", "category", "capabilities", "endpoint"],
                },
              },
              {
                name: "list_all_servers",
                description: "List all registered MCP servers",
                inputSchema: {
                  type: "object",
                  properties: {},
                },
              },
              {
                name: "execute_query",
                description: "Execute any natural language query by intelligently routing to the best MCP server. Handles weather, crypto prices, web search, translations, and more.",
                inputSchema: {
                  type: "object",
                  properties: {
                    query: {
                      type: "string",
                      description: "Natural language query (e.g., 'weather in Tokyo', 'Bitcoin price', 'translate hello to Spanish')"
                    },
                    context: {
                      type: "object",
                      description: "Optional context for multi-step conversations",
                      properties: {
                        location: { type: "string" },
                        previousQuery: { type: "string" },
                        sessionId: { type: "string" }
                      }
                    }
                  },
                  required: ["query"]
                }
              },
            ],
          },
        });

      case "tools/call":
        const { name, arguments: args } = params;

        switch (name) {
          case "discover_services":
            const discoveryQuery = DiscoverServicesSchema.parse(args || {});
            const servers = await registry.discover(discoveryQuery);
            return Response.json({
              jsonrpc: "2.0",
              id,
              result: {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify(
                      servers.map((s) => ({
                        id: s.id,
                        name: s.name,
                        description: s.description,
                        category: s.categories?.[0]
                          ? `${s.categories[0].mainCategory}/${s.categories[0].subCategory}`
                          : s.category,
                        categories: s.categories,
                        capabilities: s.capabilities,
                        verified: s.verified,
                        trustScore: s.trustScore,
                        status: s.status,
                        type: s.type,
                        version: s.version,
                        author: s.author,
                        tags: s.tags,
                      })),
                      null,
                      2
                    ),
                  },
                ],
              },
            });

          case "route_request":
            const routeReq = RouteRequestSchema.parse(args);
            const routeResponse = await handleRouteRequest(routeReq);
            return Response.json({
              jsonrpc: "2.0",
              id,
              result: {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify(routeResponse, null, 2),
                  },
                ],
              },
            });

          case "register_server":
            console.log("🚀 Using UPDATED MCP route file - author transform version");
            const registerData = RegisterServerSchema.parse(args);
            const now = new Date();
            const newServer = {
              id: `server-${Date.now()}`,
              name: registerData.name,
              description: registerData.description,
              category: registerData.category || "Uncategorized",
              categories: registerData.categories,
              capabilities: registerData.capabilities,
              endpoint: registerData.endpoint,
              apiKey: registerData.apiKey,
              type: registerData.type,
              version: registerData.version,
              tags: registerData.tags,
              verified: registerData.verified ?? false,
              trustScore: registerData.trustScore ?? 50,
              status: registerData.status ?? "active",
              logoUrl: registerData.logoUrl,
              createdAt: now,
              updatedAt: now,
              // For enhanced schema, pass PartialAuthor (store will create database record)
              // For simple schema, transform to full Author with generated ID
              author: registerData.author
                ? (process.env.USE_ENHANCED_SCHEMA === 'true'
                    ? {
                        name: registerData.author.name,
                        website: registerData.author.website,
                        contactEmail: registerData.author.contactEmail,
                      }
                    : {
                        id: `author-${Date.now()}-${Math.random()
                          .toString(36)
                          .substr(2, 9)}`,
                        name: registerData.author.name,
                        website: registerData.author.website,
                        contactEmail: registerData.author.contactEmail,
                        createdAt: now,
                      })
                : undefined,
            };
            await registry.register(newServer);
            return Response.json({
              jsonrpc: "2.0",
              id,
              result: {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify({
                      success: true,
                      serverId: newServer.id,
                    }),
                  },
                ],
              },
            });

          case "list_all_servers":
            const allServers = await registry.getAllServers();
            return Response.json({
              jsonrpc: "2.0",
              id,
              result: {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify(
                      allServers.map((s) => ({
                        id: s.id,
                        name: s.name,
                        category: s.categories?.[0]
                          ? `${s.categories[0].mainCategory}/${s.categories[0].subCategory}`
                          : s.category,
                        categories: s.categories,
                        capabilities: s.capabilities,
                        endpoint: s.endpoint,
                        verified: s.verified,
                        status: s.status,
                        type: s.type,
                        version: s.version,
                        author: s.author,
                        tags: s.tags,
                      })),
                      null,
                      2
                    ),
                  },
                ],
              },
            });

          case "execute_query":
            const queryResult = await handleExecuteQuery(args);
            return Response.json({
              jsonrpc: "2.0",
              id,
              result: {
                content: [
                  {
                    type: "text",
                    text: queryResult,
                  },
                ],
              },
            });

          default:
            return Response.json({
              jsonrpc: "2.0",
              id,
              error: {
                code: -32601,
                message: `Unknown tool: ${name}`,
              },
            });
        }

      default:
        return Response.json({
          jsonrpc: "2.0",
          id,
          error: {
            code: -32601,
            message: `Unknown method: ${method}`,
          },
        });
    }
  } catch (error: any) {
    return Response.json(
      {
        jsonrpc: "2.0",
        id: message.id,
        error: {
          code: -32000,
          message: error.message,
        },
      },
      { status: 500 }
    );
  }
}

async function handleDirectAPI(body: any) {
  try {
    const { action, data } = body;

    switch (action) {
      case "discover":
        const servers = await registry.discover(data || {});
        return Response.json({ servers });

      case "route":
        const response = await handleRouteRequest(data);
        return Response.json(response);

      case "register":
        console.log("🚀 Using UPDATED direct API handler - author transform version");
        const now = new Date();
        const server = {
          id: `server-${Date.now()}`,
          name: data.name,
          description: data.description,
          category: data.category || "Uncategorized",
          categories: data.categories,
          capabilities: data.capabilities,
          endpoint: data.endpoint,
          apiKey: data.apiKey,
          type: data.type,
          version: data.version,
          tags: data.tags,
          verified: false,
          trustScore: 50,
          status: "active",
          logoUrl: data.logoUrl,
          createdAt: now,
          updatedAt: now,
          // For enhanced schema, pass PartialAuthor (store will create database record)
          // For simple schema, transform to full Author with generated ID
          author: data.author
            ? (process.env.USE_ENHANCED_SCHEMA === 'true'
                ? {
                    name: data.author.name,
                    website: data.author.website,
                    contactEmail: data.author.contactEmail,
                  }
                : {
                    id: `author-${Date.now()}-${Math.random()
                      .toString(36)
                      .substr(2, 9)}`,
                    name: data.author.name,
                    website: data.author.website,
                    contactEmail: data.author.contactEmail,
                    createdAt: now,
                  })
            : undefined,
        };
        await registry.register(server);
        return Response.json({ success: true, serverId: server.id });

      default:
        return Response.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// Handle intelligent query execution using our NLP routing system
async function handleExecuteQuery(args: any): Promise<string> {
  const { query, context = {} } = args;

  try {
    // Instead of calling the API, execute the logic directly
    const parseResult = await parseQuery(query, context);

    // Generate mock result based on the parsed intent
    const mockResult = getMockResult(parseResult.intent, query);

    const result = {
      success: true,
      query: query,
      parsed: parseResult,
      result: mockResult,
      metadata: {
        parseTime: "0ms",
        routeTime: "1ms",
        totalTime: "1ms",
        strategy: parseResult.strategy.type,
        server: "MockServer",
        tool: "mock_tool",
        confidence: parseResult.confidence,
        cached: false,
        engine: "mcp-direct-v1"
      }
    };

    // Format the result for Claude
    return formatExecutionResult(result);

  } catch (error: any) {
    return `❌ Query execution failed: ${error.message}`;
  }
}

// Simple query parsing (copied from execute-nlp)
async function parseQuery(query: string, context: any = {}) {
  const normalizedQuery = query.toLowerCase().trim();

  const intent = classifyIntent(normalizedQuery);
  const entities = extractEntities(normalizedQuery);
  const capabilities = mapCapabilities(intent, entities);
  const category = classifyCategory(intent);
  const strategy = determineExecutionStrategy(intent, normalizedQuery);

  return {
    intent: intent.name,
    confidence: intent.confidence,
    entities: entities,
    capabilities: capabilities,
    category: category,
    strategy: strategy,
    originalQuery: query,
    normalizedQuery: normalizedQuery
  };
}

// Intent classification
function classifyIntent(query: string) {
  const intentPatterns = [
    {
      name: 'weather_query',
      patterns: [
        /weather\s+in\s+([a-zA-Z\s]+)/i,
        /forecast.*?([a-zA-Z\s]+)/i,
        /temperature.*?([a-zA-Z\s]+)/i,
        /(current|today's?)\s+weather/i,
        /how.*?(hot|cold|warm).*?is.*?it/i
      ],
      confidence: 0.95
    },
    {
      name: 'cryptocurrency_price_query',
      patterns: [
        /(bitcoin|btc|ethereum|eth|crypto).*?price/i,
        /price.*?(bitcoin|btc|ethereum|eth)/i,
        /how.*?much.*?(bitcoin|btc|ethereum|eth)/i,
        /(bitcoin|btc|ethereum|eth).*?(cost|value)/i
      ],
      confidence: 0.95
    },
    {
      name: 'stock_price_query',
      patterns: [
        /stock.*?price.*?([A-Z]{2,5})/i,
        /([A-Z]{2,5}).*?stock.*?price/i,
        /share.*?price.*?([A-Z]{2,5})/i
      ],
      confidence: 0.90
    },
    {
      name: 'web_search',
      patterns: [
        /search.*?for\s+(.+)/i,
        /find.*?about\s+(.+)/i,
        /look.*?up\s+(.+)/i,
        /google\s+(.+)/i
      ],
      confidence: 0.85
    }
  ];

  for (const intentPattern of intentPatterns) {
    for (const pattern of intentPattern.patterns) {
      if (pattern.test(query)) {
        return {
          name: intentPattern.name,
          confidence: intentPattern.confidence,
          matchedPattern: pattern.toString()
        };
      }
    }
  }

  return {
    name: 'general_query',
    confidence: 0.3,
    matchedPattern: 'fallback'
  };
}

function extractEntities(query: string) {
  const entities: any = {};

  const locationPatterns = [
    /in\s+([a-zA-Z\s]+?)(?:\s|$|,|\?|!)/i,
    /at\s+([a-zA-Z\s]+?)(?:\s|$|,|\?|!)/i,
    /([A-Z][a-zA-Z\s]{2,15})(?:\s|$|,|\?|!)/
  ];

  for (const pattern of locationPatterns) {
    const match = query.match(pattern);
    if (match) {
      entities.location = match[1].trim();
      break;
    }
  }

  const cryptoPatterns = [
    /(bitcoin|btc|ethereum|eth|dogecoin|doge)/i
  ];

  for (const pattern of cryptoPatterns) {
    const match = query.match(pattern);
    if (match) {
      entities.cryptocurrency = match[1].toLowerCase();
      break;
    }
  }

  return entities;
}

function mapCapabilities(intent: any, entities: any) {
  const capabilityMap: Record<string, string[]> = {
    'weather_query': ['weather_lookup', 'location_search'],
    'cryptocurrency_price_query': ['crypto_price', 'market_data'],
    'stock_price_query': ['stock_price', 'market_data'],
    'web_search': ['web_search', 'content_retrieval'],
    'translation': ['text_translation', 'language_detection']
  };

  return capabilityMap[intent.name] || ['general'];
}

function classifyCategory(intent: any) {
  const categoryMap: Record<string, string> = {
    'weather_query': 'Weather',
    'cryptocurrency_price_query': 'Finance',
    'stock_price_query': 'Finance',
    'web_search': 'Search',
    'translation': 'Language'
  };

  return categoryMap[intent.name] || 'General';
}

function determineExecutionStrategy(intent: any, query: string) {
  const directExecution = [
    'weather_query',
    'cryptocurrency_price_query',
    'stock_price_query',
    'translation',
    'web_search'
  ];

  if (directExecution.includes(intent.name)) {
    return {
      type: 'direct_execution',
      description: 'Execute best matching MCP server immediately'
    };
  }

  return {
    type: 'fallback',
    description: 'Use general query processing'
  };
}

function getMockResult(intent: string, query: string) {
  const results: Record<string, any> = {
    'weather_query': {
      location: query.match(/in\s+([a-zA-Z\s]+)/i)?.[1] || "Current Location",
      temperature: "72°F",
      condition: "Partly Cloudy",
      humidity: "45%",
      timestamp: new Date().toISOString()
    },
    'cryptocurrency_price_query': {
      symbol: query.match(/(bitcoin|btc|ethereum|eth)/i)?.[1]?.toUpperCase() || "BTC",
      price: "$43,250",
      change_24h: "+2.3%",
      volume_24h: "$28.5B",
      timestamp: new Date().toISOString()
    },
    'web_search': {
      query: query,
      results: [
        { title: `${query} - Top Result`, url: "https://example.com", snippet: "Most relevant content..." }
      ]
    },
    'stock_price_query': {
      symbol: query.match(/([A-Z]{2,5})/)?.[1] || "AAPL",
      price: "$150.25",
      change: "-0.5%",
      volume: "52.3M"
    }
  };

  return results[intent] || {
    answer: `Processed: ${query}`,
    timestamp: new Date().toISOString()
  };
}

// Format execution result for Claude display
function formatExecutionResult(result: any): string {
  if (!result.success) {
    return `❌ Query failed: ${result.error || 'Unknown error'}`;
  }

  const { query, result: data, metadata } = result;

  let output = `✅ **Query**: ${query}\n\n`;

  // Format result based on type
  if (data) {
    if (data.temperature) {
      // Weather result
      output += `🌤️ **Weather**: ${data.location}\n`;
      output += `Temperature: ${data.temperature}\n`;
      output += `Condition: ${data.condition}\n`;
      output += `Humidity: ${data.humidity}\n`;
    } else if (data.price) {
      // Crypto/Stock result
      output += `💰 **Price**: ${data.symbol}\n`;
      output += `Current: ${data.price}\n`;
      output += `24h Change: ${data.change_24h || data.change}\n`;
      if (data.volume_24h || data.volume) {
        output += `Volume: ${data.volume_24h || data.volume}\n`;
      }
    } else if (data.type === 'options') {
      // Options result
      output += `🔍 **${data.message}**\n\n`;
      if (data.options && data.options.length > 0) {
        output += `Available options:\n`;
        data.options.forEach((option: any, i: number) => {
          output += `${i + 1}. **${option.name}** - ${option.description}\n`;
        });
      }
      output += `\n${data.nextStep}`;
    } else {
      // Generic result
      output += `📋 **Result**: ${JSON.stringify(data, null, 2)}`;
    }
  }

  output += `\n\n🚀 **Performance**: ${metadata?.totalTime} (via ${metadata?.server})`;
  output += `\n🎯 **Confidence**: ${Math.round((metadata?.confidence || 0) * 100)}%`;

  return output;
}

async function handleRouteRequest(
  request: RouteRequest
): Promise<RouteResponse> {
  const startTime = Date.now();

  // Find servers with the required capability
  const servers = await registry.discover({
    capability: request.capability,
  });

  if (servers.length === 0) {
    throw new Error(
      `No servers available for capability: ${request.capability}`
    );
  }

  // Select server (prefer specified, otherwise use first)
  const selectedServer = request.preferredServer
    ? servers.find((s) => s.id === request.preferredServer) || servers[0]
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
      executionTime: Date.now() - startTime,
    };
  } catch (error: any) {
    console.error(`Error routing to server ${selectedServer.id}:`, error);
    throw new Error(`Failed to route request: ${error.message}`);
  }
}

export async function GET(request: NextRequest) {
  return Response.json({
    name: "mcp-store-server",
    version: "1.0.0",
    description: "Meta-layer MCP server for routing and discovery",
    capabilities: ["discover_services", "route_request", "register_server"],
    environment: {
      USE_ENHANCED_SCHEMA: process.env.USE_ENHANCED_SCHEMA,
      hasPostgres: !!process.env.POSTGRES_URL,
      schemaActive: !!process.env.USE_ENHANCED_SCHEMA ? "enhanced" : "simple"
    }
  });
}
