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

  // Log every API call
  console.log(`📡 MCP API called: method=${body.method}, tool=${body.params?.name}`);

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
              {
                name: "mcp_finder",
                description: "Find and analyze which MCP servers can potentially answer a query. Shows routing logic and server candidates before execution.",
                inputSchema: {
                  type: "object",
                  properties: {
                    query: {
                      type: "string",
                      description: "Query to find MCP servers for (e.g., 'who wrote the book xyz?')"
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
            console.log('🔍 API: list_all_servers called');
            const allServers = await registry.getAllServers();

            // Check for LibraLM
            const hasLibraLM = allServers.some(s => s.id === 'ext_1588');
            console.log(`🎯 API LibraLM CHECK: ${hasLibraLM ? '✅ FOUND' : '❌ NOT FOUND'} in ${allServers.length} servers`);

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

          case "mcp_finder":
            const finderResult = await handleMcpFinder(args);
            return Response.json({
              jsonrpc: "2.0",
              id,
              result: {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify(finderResult, null, 2),
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

// MCP FINDER: Show all potential servers for a query without calling them
async function handleMcpFinder(args: any) {
  const { query } = args;

  try {
    console.log(`🔍 DEBUG Server Matching for: "${query}"`);

    // Parse the query to understand intent
    const parseResult = await parseQuery(query, {});
    console.log(`📊 Parsed Intent: ${parseResult.intent}, Confidence: ${parseResult.confidence}`);

    // Get all available MCP servers from registry
    const allServers = await registry.getAllServers();
    console.log(`🌐 Total MCP servers available: ${allServers.length}`);

    // Filter servers by intent-specific criteria (same logic as findBestServer)
    let candidates = allServers.filter(server => {
      // Must be active
      if (server.status !== 'active') return false;

      // For book queries, look for book/literature servers
      if (parseResult.intent === 'book_query') {
        // First exclude irrelevant servers
        const serverName = server.name.toLowerCase();
        const isIrrelevant = serverName.includes('hotel') ||
                            serverName.includes('booking') ||
                            serverName.includes('facebook') ||
                            serverName.includes('youtube') ||
                            serverName.includes('weather') ||
                            serverName.includes('crypto') ||
                            serverName.includes('bitcoin') ||
                            serverName.includes('ads');

        if (isIrrelevant) return false;

        const hasBookCapability = server.capabilities?.some((cap: string) =>
          cap.toLowerCase().includes('book') ||
          cap.toLowerCase().includes('literature') ||
          cap.toLowerCase().includes('summary')
        );
        const hasBookCategory = server.categories?.some((cat: any) =>
          cat.mainCategory?.toLowerCase().includes('book') ||
          cat.mainCategory?.toLowerCase().includes('literature') ||
          cat.subCategory?.toLowerCase().includes('book') ||
          cat.subCategory?.toLowerCase().includes('literature')
        );
        const hasBookInName = server.name.toLowerCase().includes('book') ||
                             server.name.toLowerCase().includes('finder') ||
                             server.name.toLowerCase().includes('libra') ||
                             server.name.toLowerCase().includes('literature');

        return hasBookCapability || hasBookCategory || hasBookInName;
      }

      return true; // Include all servers for non-book queries
    });

    return {
      query: query,
      parsed_intent: parseResult.intent,
      intent_confidence: parseResult.confidence,
      total_servers: allServers.length,
      matching_servers: candidates.length,
      candidates: candidates.map(server => ({
        name: server.name,
        id: server.id,
        endpoint: server.endpoint,
        capabilities: server.capabilities,
        categories: server.categories,
        verified: server.verified,
        trustScore: server.trustScore,
        status: server.status
      })),
      assessment: candidates.length > 0 ?
        (candidates.length >= 3 ? "GOOD - Multiple relevant servers found" :
         candidates.length === 1 ? "OKAY - Single server found" :
         "LIMITED - Few servers found") :
        "BAD - No relevant servers found"
    };

  } catch (error: any) {
    return {
      error: `Debug failed: ${error.message}`,
      query: query
    };
  }
}

// Handle intelligent query execution using our NLP routing system
async function handleExecuteQuery(args: any): Promise<string> {
  const { query, context = {} } = args;

  try {
    console.log(`🔍 Execute Query: "${query}"`);

    // Parse the query to understand intent
    const parseResult = await parseQuery(query, context);
    console.log(`📊 Intent: ${parseResult.intent}, Confidence: ${parseResult.confidence}`);

    // Get all available MCP servers from registry
    const servers = await registry.getAllServers();
    console.log(`🌐 Available MCP servers: ${servers.length}`);

    // Find best matching server for the query
    const matchedServer = await findBestServer(parseResult, servers);

    if (!matchedServer) {
      return `❌ No MCP server found for query: "${query}". Available servers: ${servers.length}. Try: weather queries, crypto prices, or book summaries.`;
    }

    console.log(`🎯 Matched server: ${matchedServer.name} (${matchedServer.endpoint})`);

    // Route to the actual MCP server
    const startTime = Date.now();
    const mcpResult = await routeToMCPServer(matchedServer, query, parseResult);
    const executionTime = Date.now() - startTime;

    const result = {
      success: true,
      query: query,
      parsed: parseResult,
      result: mcpResult,
      metadata: {
        parseTime: "1ms",
        routeTime: `${executionTime}ms`,
        totalTime: `${executionTime + 1}ms`,
        strategy: parseResult.strategy.type,
        server: matchedServer.name,
        tool: "real_mcp_server",
        confidence: parseResult.confidence,
        cached: false,
        engine: "mcp-registry-v1"
      }
    };

    // Format the result for Claude
    return formatExecutionResult(result);

  } catch (error: any) {
    console.error(`❌ Execute Query Error:`, error);
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
      name: 'book_query',
      patterns: [
        /who.*?(wrote|author).*?([a-zA-Z\s]+)/i,
        /author.*?(of|book).*?([a-zA-Z\s]+)/i,
        /book.*?(summary|about|author).*?([a-zA-Z\s]+)/i,
        /summary.*?of.*?([a-zA-Z\s]+)/i,
        /(great\s+gatsby|1984|pride\s+and\s+prejudice|harry\s+potter|to\s+kill\s+a\s+mockingbird)/i,
        /tell.*?me.*?about.*?(book|novel|author)/i,
        /literature.*?([a-zA-Z\s]+)/i,
        /novel.*?([a-zA-Z\s]+)/i,
        /who\s+was\s+the\s+author/i,
        /wrote\s+the\s+(book|novel)/i,
        /(gatsby|shakespeare|dickens|austen|rowling)/i
      ],
      confidence: 0.95
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
    'book_query': ['book_summary', 'literature_analysis', 'author_info'],
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
    'book_query': 'Literature',
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
    'book_query',
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

// NO MORE MOCK RESULTS - Always use real MCP servers
function getRealServerError(intent: string, query: string, reason: string) {
  return {
    error: `No real MCP server available for ${intent}`,
    query: query,
    reason: reason,
    attempted_real_call: true,
    timestamp: new Date().toISOString()
  };
}

// Score book server specificity (higher = more book-specific)
function getBookSpecificityScore(server: any): number {
  const name = server.name.toLowerCase();

  // Highest priority: Direct book services
  if (name.includes('libralm') || name.includes('google books') || name.includes('open library')) return 10;
  if (name.includes('book search') || name.includes('bookstack')) return 9;

  // Medium priority: General book/literature servers
  if (name.includes('book') && !name.includes('booking')) return 8;
  if (name.includes('literature') || name.includes('library')) return 7;

  // Low priority: Tangentially related
  if (name.includes('finder') && !name.includes('hotel') && !name.includes('job')) return 3;

  // Irrelevant servers
  if (name.includes('hotel') || name.includes('booking') || name.includes('facebook') ||
      name.includes('youtube') || name.includes('weather') || name.includes('crypto')) return 0;

  return 5; // Default score
}

// Find the best matching MCP server for a parsed query
async function findBestServer(parseResult: any, servers: any[]) {
  const { intent, capabilities, category, entities } = parseResult;

  console.log(`🔍 Finding best server for intent: ${intent}, category: ${category}`);

  // Filter servers by intent-specific criteria
  let candidates = servers.filter(server => {
    // Must be active
    if (server.status !== 'active') return false;

    // For book queries, look for book/literature servers
    if (intent === 'book_query') {
      // First exclude irrelevant servers
      const serverName = server.name.toLowerCase();
      const isIrrelevant = serverName.includes('hotel') ||
                          serverName.includes('booking') ||
                          serverName.includes('facebook') ||
                          serverName.includes('youtube') ||
                          serverName.includes('weather') ||
                          serverName.includes('crypto') ||
                          serverName.includes('bitcoin') ||
                          serverName.includes('ads');

      if (isIrrelevant) return false;

      const hasBookCapability = server.capabilities?.some((cap: string) =>
        cap.toLowerCase().includes('book') ||
        cap.toLowerCase().includes('literature') ||
        cap.toLowerCase().includes('summary')
      );
      const hasBookCategory = server.categories?.some((cat: any) =>
        cat.mainCategory?.toLowerCase().includes('book') ||
        cat.mainCategory?.toLowerCase().includes('literature') ||
        cat.subCategory?.toLowerCase().includes('book') ||
        cat.subCategory?.toLowerCase().includes('literature')
      );
      const hasBookInName = server.name.toLowerCase().includes('book') ||
                           server.name.toLowerCase().includes('finder') ||
                           server.name.toLowerCase().includes('libra') ||
                           server.name.toLowerCase().includes('literature');

      return hasBookCapability || hasBookCategory || hasBookInName;
    }

    // For weather queries, look for weather servers
    if (intent === 'weather_query') {
      const hasWeatherCapability = server.capabilities?.some((cap: string) =>
        cap.toLowerCase().includes('weather') ||
        cap.toLowerCase().includes('forecast')
      );
      const hasWeatherCategory = server.categories?.some((cat: any) =>
        cat.mainCategory?.toLowerCase().includes('weather') ||
        cat.subCategory?.toLowerCase().includes('weather')
      );

      return hasWeatherCapability || hasWeatherCategory;
    }

    // For crypto queries, look for finance/crypto servers
    if (intent === 'cryptocurrency_price_query') {
      const hasCryptoCapability = server.capabilities?.some((cap: string) =>
        cap.toLowerCase().includes('crypto') ||
        cap.toLowerCase().includes('bitcoin') ||
        cap.toLowerCase().includes('price') ||
        cap.toLowerCase().includes('finance')
      );
      const hasCryptoCategory = server.categories?.some((cat: any) =>
        cat.mainCategory?.toLowerCase().includes('finance') ||
        cat.mainCategory?.toLowerCase().includes('crypto') ||
        cat.subCategory?.toLowerCase().includes('crypto')
      );

      return hasCryptoCapability || hasCryptoCategory;
    }

    // For general queries, check capabilities match
    if (capabilities && capabilities.length > 0) {
      return server.capabilities?.some((cap: string) =>
        capabilities.some((reqCap: string) =>
          cap.toLowerCase().includes(reqCap.toLowerCase())
        )
      );
    }

    return true; // Include all servers for general queries
  });

  console.log(`📊 Filtered ${candidates.length} candidate servers from ${servers.length} total`);

  if (candidates.length === 0) {
    console.log(`❌ No matching servers found for intent: ${intent}`);
    return null;
  }

  // Sort by relevance and trust score - prioritize book-specific servers
  candidates.sort((a, b) => {
    // For book queries, prioritize book-specific servers
    if (intent === 'book_query') {
      const aBookScore = getBookSpecificityScore(a);
      const bBookScore = getBookSpecificityScore(b);
      if (aBookScore !== bBookScore) return bBookScore - aBookScore;
    }

    // Prefer verified servers
    if (a.verified && !b.verified) return -1;
    if (!a.verified && b.verified) return 1;

    // Prefer servers with authentication configured (can actually be called)
    const aHasAuth = !!(a.apiKey || a.endpoint?.includes('api_key='));
    const bHasAuth = !!(b.apiKey || b.endpoint?.includes('api_key='));
    if (aHasAuth && !bHasAuth) return -1;
    if (!aHasAuth && bHasAuth) return 1;

    // Prefer higher trust scores
    const trustA = a.trustScore || 50;
    const trustB = b.trustScore || 50;
    if (trustA !== trustB) return trustB - trustA;

    // Prefer servers with more matching capabilities
    const matchingCapsA = capabilities ?
      a.capabilities?.filter((cap: string) =>
        capabilities.some((reqCap: string) =>
          cap.toLowerCase().includes(reqCap.toLowerCase())
        )
      ).length || 0 : 0;
    const matchingCapsB = capabilities ?
      b.capabilities?.filter((cap: string) =>
        capabilities.some((reqCap: string) =>
          cap.toLowerCase().includes(reqCap.toLowerCase())
        )
      ).length || 0 : 0;

    return matchingCapsB - matchingCapsA;
  });

  const bestServer = candidates[0];
  const hasAuth = !!(bestServer.apiKey || bestServer.endpoint?.includes('api_key='));
  console.log(`🎯 Selected server: ${bestServer.name} (verified: ${bestServer.verified}, trust: ${bestServer.trustScore}, auth: ${hasAuth})`);

  return bestServer;
}

// Route query to actual MCP server
async function routeToMCPServer(server: any, query: string, parseResult: any) {
  try {
    console.log(`🚀 Routing to REAL MCP server: ${server.name} at ${server.endpoint}`);

    // Use the MCP client to route the request to the ACTUAL server
    const routeRequest = {
      capability: parseResult.capabilities[0] || 'general',
      method: 'query', // Standard method name
      params: {
        query: query,
        intent: parseResult.intent,
        entities: parseResult.entities
      },
      preferredServer: server.id
    };

    console.log(`📡 Making REAL call to MCP server: ${server.name}`);
    const response = await handleRouteRequest(routeRequest);

    if (response && response.response) {
      console.log(`✅ SUCCESS: Real response from ${server.name}:`, response.response);
      return response.response;
    } else {
      console.log(`❌ EMPTY RESPONSE from real MCP server: ${server.name}`);
      return {
        error: `Real MCP server ${server.name} returned empty response`,
        server: server.name,
        endpoint: server.endpoint,
        attempted_call: true
      };
    }

  } catch (error: any) {
    console.error(`❌ REAL MCP CALL FAILED to ${server.name}:`, error.message);

    return {
      error: `Real MCP server call failed: ${error.message}`,
      server: server.name,
      endpoint: server.endpoint,
      attempted_call: true,
      error_details: error
    };
  }
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
    } else if (data.author && data.title) {
      // Book result
      output += `📚 **Book**: ${data.title}\n`;
      output += `Author: ${data.author}\n`;
      if (data.summary) {
        output += `Summary: ${data.summary}\n`;
      }
      if (data.publishedYear) {
        output += `Published: ${data.publishedYear}\n`;
      }
      if (data.genre) {
        output += `Genre: ${data.genre}\n`;
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
