import { NextRequest } from "next/server";
import { sql } from '@vercel/postgres';
import crypto from 'crypto';

// V3: HYBRID Ultra-Fast + Smart Routing
// Strategy: Fast primary query + parallel smart scoring

const routeCache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 300000; // 5 minutes cache for production

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { intent, query, capabilities = [], category, params = {}, requireVerified = false } = body;

    const startTime = Date.now();

    // Generate cache key
    const cacheKey = crypto.createHash('md5').update(JSON.stringify({ intent, query, capabilities, category })).digest('hex');

    // Check cache first
    const cached = routeCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      return Response.json({
        ...cached.data,
        metadata: {
          ...cached.data.metadata,
          cached: true,
          cacheAge: `${Date.now() - cached.timestamp}ms`
        }
      });
    }

    // STRATEGY: Run 3 queries in PARALLEL for maximum speed
    const [fastResults, smartResults, fallbackResults] = await Promise.allSettled([
      // Query 1: ULTRA-FAST basic matching (like V1)
      runFastQuery(category, capabilities, query),

      // Query 2: SMART semantic matching (parallel)
      runSmartQuery(intent, query, capabilities, category, requireVerified),

      // Query 3: FALLBACK broad matching
      runFallbackQuery(query, capabilities)
    ]);

    const routingTime = Date.now() - startTime;

    // Merge and rank all results
    const allServers = combineResults(fastResults, smartResults, fallbackResults);

    if (allServers.length === 0) {
      return Response.json({
        success: false,
        error: "No suitable MCP server found",
        queryTime: `${routingTime}ms`,
        queriesAttempted: 3
      }, { status: 404 });
    }

    // Score and select best server
    const rankedServers = rankServers(allServers, { intent, query, capabilities, category });
    const bestServer = rankedServers[0];
    const alternatives = rankedServers.slice(1, 3);

    // Find best tool
    const tools = typeof bestServer.tools === 'string' ? JSON.parse(bestServer.tools) : bestServer.tools;
    const matchingTool = findBestTool(tools, intent, capabilities, query);

    if (!matchingTool && alternatives.length > 0) {
      // Try next server
      const nextServer = alternatives[0];
      const nextTools = typeof nextServer.tools === 'string' ? JSON.parse(nextServer.tools) : nextServer.tools;
      const nextTool = findBestTool(nextTools, intent, capabilities, query);

      if (nextTool) {
        return createFinalResponse(nextServer, nextTool, alternatives.slice(1), {
          routingTime, startTime, cacheKey, intent, query, fastQuery: true
        });
      }
    }

    if (!matchingTool) {
      return Response.json({
        success: false,
        error: "No matching tool found",
        availableServers: rankedServers.slice(0, 3).map(s => s.display_name),
        queryTime: `${routingTime}ms`
      }, { status: 404 });
    }

    return createFinalResponse(bestServer, matchingTool, alternatives, {
      routingTime, startTime, cacheKey, intent, query, fastQuery: true
    });

  } catch (error: any) {
    console.error('V3 routing error:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

// Query 1: Ultra-fast basic matching (optimized for speed)
async function runFastQuery(category: string, capabilities: string[], query: string) {
  const conditions = [];
  const params = [];
  let paramIndex = 0;

  if (category) {
    conditions.push(`category ILIKE $${++paramIndex}`);
    params.push(`%${category}%`);
  }

  if (capabilities.length > 0) {
    conditions.push(`tools::text ILIKE $${++paramIndex}`);
    params.push(`%${capabilities[0]}%`); // Just first capability for speed
  }

  if (query) {
    conditions.push(`(display_name ILIKE $${++paramIndex} OR description ILIKE $${++paramIndex})`);
    params.push(`%${query}%`, `%${query}%`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : 'WHERE 1=1';

  const queryText = `
    SELECT qualified_name, display_name, description, category, deployment_url,
           tools, is_remote, security_scan_passed, use_count, author, 'fast' as source
    FROM smithery_mcp_servers
    ${whereClause}
    AND security_scan_passed = true
    ORDER BY use_count DESC
    LIMIT 10
  `;

  return sql.query(queryText, params);
}

// Query 2: Smart semantic matching (runs in parallel)
async function runSmartQuery(intent: string, query: string, capabilities: string[], category: string, requireVerified: boolean) {
  // Semantic expansion
  const semanticTerms = getSemanticExpansions(query, intent);
  const allTerms = [...new Set([query, ...capabilities, ...semanticTerms])].filter(Boolean);

  if (allTerms.length === 0) {
    return { rows: [] };
  }

  // Build SIMPLE but smart query (avoid complex scoring in SQL)
  const termConditions = allTerms.map((_, i) =>
    `(display_name ILIKE $${i + 1} OR description ILIKE $${i + 1} OR tools::text ILIKE $${i + 1})`
  );

  const whereClause = `
    WHERE (${termConditions.join(' OR ')})
    ${category ? `AND category ILIKE $${allTerms.length + 1}` : ''}
    ${requireVerified ? 'AND security_scan_passed = true' : ''}
  `;

  const params = [
    ...allTerms.map(term => `%${term}%`),
    ...(category ? [`%${category}%`] : [])
  ];

  const queryText = `
    SELECT qualified_name, display_name, description, category, deployment_url,
           tools, is_remote, security_scan_passed, use_count, author, 'smart' as source
    FROM smithery_mcp_servers
    ${whereClause}
    ORDER BY use_count DESC
    LIMIT 15
  `;

  return sql.query(queryText, params);
}

// Query 3: Fallback broad matching
async function runFallbackQuery(query: string, capabilities: string[]) {
  if (!query && capabilities.length === 0) {
    return { rows: [] };
  }

  const searchTerms = [query, ...capabilities].filter(Boolean);
  if (searchTerms.length === 0) {
    return { rows: [] };
  }

  const queryText = `
    SELECT qualified_name, display_name, description, category, deployment_url,
           tools, is_remote, security_scan_passed, use_count, author, 'fallback' as source
    FROM smithery_mcp_servers
    WHERE tools::text ILIKE $1
    OR tags::text ILIKE $1
    OR description ILIKE $1
    ORDER BY
      CASE WHEN security_scan_passed THEN 1 ELSE 0 END DESC,
      use_count DESC
    LIMIT 20
  `;

  return sql.query(queryText, [`%${searchTerms[0]}%`]);
}

// Combine results from all queries
function combineResults(...results: any[]) {
  const allServers = [];
  const seen = new Set();

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value?.rows) {
      for (const server of result.value.rows) {
        if (!seen.has(server.qualified_name)) {
          seen.add(server.qualified_name);
          allServers.push(server);
        }
      }
    }
  }

  return allServers;
}

// Fast client-side ranking (instead of complex SQL)
function rankServers(servers: any[], searchParams: any) {
  const { intent, query, capabilities, category } = searchParams;

  return servers.map(server => {
    let score = 0;

    // Source bonus
    if (server.source === 'fast') score += 10;
    else if (server.source === 'smart') score += 15;
    else score += 5;

    // Security bonus
    if (server.security_scan_passed) score += 20;

    // Use count (normalized)
    score += Math.log10(server.use_count + 1) * 3;

    // Exact matches
    const lowerQuery = query?.toLowerCase() || '';
    const lowerName = server.display_name?.toLowerCase() || '';
    const lowerDesc = server.description?.toLowerCase() || '';

    if (lowerName.includes(lowerQuery)) score += 25;
    if (lowerDesc.includes(lowerQuery)) score += 15;
    if (server.category === category) score += 20;

    // Capability matching
    const toolsText = JSON.stringify(server.tools || {}).toLowerCase();
    capabilities.forEach((cap: string) => {
      if (toolsText.includes(cap.toLowerCase())) score += 10;
    });

    return { ...server, finalScore: score };
  }).sort((a, b) => b.finalScore - a.finalScore);
}

// Get semantic expansions
function getSemanticExpansions(query: string, intent: string): string[] {
  const expansions = new Set<string>();

  const semanticMap: Record<string, string[]> = {
    'bitcoin': ['btc', 'crypto', 'cryptocurrency'],
    'btc': ['bitcoin', 'crypto'],
    'weather': ['forecast', 'temperature', 'climate'],
    'search': ['find', 'query', 'lookup'],
    'price': ['cost', 'value', 'rate', 'quote'],
    'stock': ['equity', 'shares', 'market'],
  };

  const lowerQuery = query?.toLowerCase() || '';

  // Add semantic variations
  Object.entries(semanticMap).forEach(([key, values]) => {
    if (lowerQuery.includes(key)) {
      values.forEach(v => expansions.add(v));
    }
  });

  // Intent-based expansions
  const intentMap: Record<string, string[]> = {
    'cryptocurrency_price_query': ['crypto', 'bitcoin', 'price', 'exchange'],
    'web_search': ['search', 'web', 'google'],
    'weather_query': ['weather', 'forecast'],
    'stock_price': ['stock', 'market', 'ticker'],
  };

  if (intentMap[intent]) {
    intentMap[intent].forEach(term => expansions.add(term));
  }

  return Array.from(expansions).slice(0, 5); // Limit for performance
}

// Fast tool matching
function findBestTool(tools: any[], intent: string, capabilities: string[], query: string) {
  if (!tools || !Array.isArray(tools)) return null;

  const intentPatterns = {
    'cryptocurrency_price_query': ['crypto', 'price', 'exchange', 'rate'],
    'web_search': ['search', 'query', 'web'],
    'weather_query': ['weather', 'forecast', 'temperature'],
    'stock_price': ['stock', 'quote', 'market'],
  };

  const patterns = [...((intentPatterns as any)[intent] || []), ...capabilities];
  if (query) patterns.push(query.toLowerCase());

  // Score tools quickly
  let bestTool = null;
  let bestScore = 0;

  for (const tool of tools) {
    let score = 0;
    const toolName = tool.name?.toLowerCase() || '';
    const toolDesc = tool.description?.toLowerCase() || '';

    patterns.forEach(pattern => {
      const lowerPattern = pattern.toLowerCase();
      if (toolName.includes(lowerPattern)) score += 10;
      if (toolDesc.includes(lowerPattern)) score += 5;
    });

    if (score > bestScore) {
      bestScore = score;
      bestTool = tool;
    }
  }

  return bestTool || tools[0]; // Fallback to first tool
}

// Create final response
function createFinalResponse(server: any, tool: any, alternatives: any[], metadata: any) {
  const { routingTime, startTime, cacheKey, intent, query, fastQuery } = metadata;

  const mockResult = getMockResult(intent, query);

  const response = {
    success: true,
    result: mockResult,
    metadata: {
      server: server.display_name,
      serverId: server.qualified_name,
      tool: tool.name,
      confidence: Math.min(server.finalScore / 100, 1.0),
      alternatives: alternatives.map(alt => ({
        server: alt.display_name,
        confidence: Math.min(alt.finalScore / 100, 1.0)
      })),
      routingTime: `${routingTime}ms`,
      totalTime: `${Date.now() - startTime}ms`,
      strategy: fastQuery ? 'parallel-hybrid' : 'fallback',
      cached: false
    }
  };

  // Cache response
  routeCache.set(cacheKey, {
    data: response,
    timestamp: Date.now()
  });

  return Response.json(response);
}

// Mock results
function getMockResult(intent: string, query: string) {
  const results: Record<string, any> = {
    'cryptocurrency_price_query': {
      symbol: "BTC",
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
    'weather_query': {
      location: query || "Current Location",
      temperature: "72°F",
      condition: "Partly Cloudy",
      humidity: "45%"
    },
    'stock_price': {
      symbol: query?.toUpperCase() || "AAPL",
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

// GET endpoint
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const intent = searchParams.get('intent') || '';
  const query = searchParams.get('query') || '';
  const capabilities = searchParams.get('capabilities')?.split(',') || [];
  const category = searchParams.get('category') || '';

  return POST(new NextRequest(request.url, {
    method: 'POST',
    body: JSON.stringify({ intent, query, capabilities, category }),
    headers: { 'Content-Type': 'application/json' }
  }));
}