import { NextRequest } from "next/server";
import { sql } from '@vercel/postgres';
import crypto from 'crypto';

// In-memory cache for frequent queries (with TTL)
const routeCache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 60000; // 1 minute cache

// Enhanced routing with multiple improvements
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

    // Enhanced query building with semantic expansion
    const semanticExpansions = expandSemantics(query, intent);
    const expandedCapabilities = expandCapabilities(capabilities);

    // Build smarter SQL query with scoring
    const { queryText, params: sqlParams } = buildEnhancedQuery({
      category,
      capabilities: expandedCapabilities,
      query,
      semanticExpansions,
      requireVerified,
      limit: 5 // Get top 5 for fallback options
    });

    const result = await sql.query(queryText, sqlParams);

    if (result.rows.length === 0) {
      // Fallback: Try without security requirement
      if (requireVerified) {
        return POST(new NextRequest(request.url, {
          method: 'POST',
          body: JSON.stringify({ ...body, requireVerified: false }),
          headers: { 'Content-Type': 'application/json' }
        }));
      }

      return Response.json({
        success: false,
        error: "No suitable MCP server found",
        suggestion: "Try broader search terms or different category",
        queryTime: `${Date.now() - startTime}ms`
      }, { status: 404 });
    }

    // Score and rank all results
    const scoredServers = result.rows.map(server => ({
      ...server,
      relevanceScore: calculateRelevanceScore(server, { intent, query, capabilities, category })
    }));

    // Sort by combined score
    scoredServers.sort((a, b) => b.relevanceScore - a.relevanceScore);

    const bestServer = scoredServers[0];
    const alternativeServers = scoredServers.slice(1);

    const routingTime = Date.now() - startTime;

    // Find best tool for intent
    const tools = typeof bestServer.tools === 'string' ? JSON.parse(bestServer.tools) : bestServer.tools;
    const matchingTool = findBestToolEnhanced(tools, intent, expandedCapabilities, query);

    if (!matchingTool) {
      // Try next server if no tool matches
      if (alternativeServers.length > 0) {
        const nextServer = alternativeServers[0];
        const nextTools = typeof nextServer.tools === 'string' ? JSON.parse(nextServer.tools) : nextServer.tools;
        const nextTool = findBestToolEnhanced(nextTools, intent, expandedCapabilities, query);

        if (nextTool) {
          // Use alternative server
          return createResponse(nextServer, nextTool, alternativeServers.slice(1), {
            intent, query, routingTime, startTime, cacheKey
          });
        }
      }

      return Response.json({
        success: false,
        error: "No matching tool found in available servers",
        availableServers: scoredServers.map(s => s.display_name),
        queryTime: `${routingTime}ms`
      }, { status: 404 });
    }

    return createResponse(bestServer, matchingTool, alternativeServers, {
      intent, query, routingTime, startTime, cacheKey
    });

  } catch (error: any) {
    console.error('AI routing error:', error);
    return Response.json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}

// Build enhanced SQL query with better scoring
function buildEnhancedQuery(options: any) {
  const { category, capabilities, query, semanticExpansions, requireVerified, limit } = options;

  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 0;

  // Category matching with weight
  if (category) {
    conditions.push(`
      CASE
        WHEN category = $${++paramIndex} THEN 10
        WHEN category ILIKE $${++paramIndex} THEN 5
        ELSE 0
      END
    `);
    params.push(category, `%${category}%`);
  }

  // Capability matching with scoring
  if (capabilities.length > 0) {
    const capScores = capabilities.map(cap => {
      paramIndex++;
      params.push(`%${cap}%`);
      return `CASE WHEN tools::text ILIKE $${paramIndex} THEN 3 ELSE 0 END`;
    });
    conditions.push(`(${capScores.join(' + ')})`);
  }

  // Query and semantic matching
  if (query || semanticExpansions.length > 0) {
    const allTerms = [query, ...semanticExpansions].filter(Boolean);
    const termScores = allTerms.map(term => {
      paramIndex++;
      params.push(`%${term}%`);
      return `
        CASE
          WHEN display_name ILIKE $${paramIndex} THEN 5
          WHEN description ILIKE $${paramIndex} THEN 3
          WHEN tools::text ILIKE $${paramIndex} THEN 2
          WHEN tags::text ILIKE $${paramIndex} THEN 1
          ELSE 0
        END
      `;
    });
    conditions.push(`(${termScores.join(' + ')})`);
  }

  // Build the final query
  const scoreCalculation = conditions.length > 0
    ? `(${conditions.join(' + ')} + (use_count * 0.001) + CASE WHEN security_scan_passed THEN 10 ELSE 0 END)`
    : '(use_count * 0.001 + CASE WHEN security_scan_passed THEN 10 ELSE 0 END)';

  const whereClause = requireVerified ? 'WHERE security_scan_passed = true' : 'WHERE 1=1';

  const queryText = `
    SELECT
      qualified_name,
      display_name,
      description,
      category,
      deployment_url,
      tools,
      tags,
      is_remote,
      security_scan_passed,
      use_count,
      author,
      ${scoreCalculation} as relevance_score
    FROM smithery_mcp_servers
    ${whereClause}
    AND ${scoreCalculation} > 0
    ORDER BY relevance_score DESC
    LIMIT ${limit}
  `;

  return { queryText, params };
}

// Expand query with semantic variations
function expandSemantics(query: string, intent: string): string[] {
  const expansions: string[] = [];

  const semanticMap: Record<string, string[]> = {
    'bitcoin': ['btc', 'crypto', 'cryptocurrency', 'digital currency'],
    'btc': ['bitcoin', 'crypto', 'cryptocurrency'],
    'weather': ['forecast', 'temperature', 'climate', 'conditions'],
    'stock': ['equity', 'shares', 'market', 'ticker'],
    'search': ['find', 'query', 'lookup', 'discover'],
    'price': ['cost', 'value', 'rate', 'quote'],
  };

  const lowerQuery = query?.toLowerCase() || '';

  // Add semantic expansions
  Object.entries(semanticMap).forEach(([key, values]) => {
    if (lowerQuery.includes(key)) {
      expansions.push(...values);
    }
  });

  // Add intent-based expansions
  const intentMap: Record<string, string[]> = {
    'cryptocurrency_price_query': ['crypto', 'exchange', 'rate'],
    'web_search': ['search', 'find', 'web'],
    'weather_query': ['weather', 'forecast', 'temperature'],
    'stock_price': ['stock', 'market', 'quote'],
  };

  if (intentMap[intent]) {
    expansions.push(...intentMap[intent]);
  }

  return [...new Set(expansions)]; // Remove duplicates
}

// Expand capabilities with related terms
function expandCapabilities(capabilities: string[]): string[] {
  const expanded = new Set(capabilities);

  const capabilityMap: Record<string, string[]> = {
    'crypto': ['cryptocurrency', 'bitcoin', 'blockchain'],
    'search': ['query', 'find', 'lookup'],
    'weather': ['forecast', 'temperature', 'climate'],
    'price': ['cost', 'value', 'rate'],
  };

  capabilities.forEach(cap => {
    const lowerCap = cap.toLowerCase();
    if (capabilityMap[lowerCap]) {
      capabilityMap[lowerCap].forEach(exp => expanded.add(exp));
    }
  });

  return Array.from(expanded);
}

// Calculate relevance score for a server
function calculateRelevanceScore(server: any, searchParams: any): number {
  let score = server.relevance_score || 0;

  // Boost for exact matches
  const lowerQuery = searchParams.query?.toLowerCase() || '';
  if (server.display_name?.toLowerCase().includes(lowerQuery)) {
    score += 15;
  }

  // Boost for verified servers
  if (server.security_scan_passed) {
    score += 10;
  }

  // Normalize use count contribution
  score += Math.log10(server.use_count + 1) * 2;

  // Category exact match bonus
  if (server.category === searchParams.category) {
    score += 10;
  }

  return score;
}

// Enhanced tool finding with fuzzy matching
function findBestToolEnhanced(tools: any[], intent: string, capabilities: string[], query: string) {
  if (!tools || !Array.isArray(tools)) return null;

  // Score each tool
  const scoredTools = tools.map(tool => {
    let score = 0;
    const toolName = tool.name?.toLowerCase() || '';
    const toolDesc = tool.description?.toLowerCase() || '';

    // Intent matching
    const intentPatterns = getIntentPatterns(intent);
    intentPatterns.forEach(pattern => {
      if (toolName.includes(pattern)) score += 10;
      if (toolDesc.includes(pattern)) score += 5;
    });

    // Capability matching
    capabilities.forEach(cap => {
      const lowerCap = cap.toLowerCase();
      if (toolName.includes(lowerCap)) score += 8;
      if (toolDesc.includes(lowerCap)) score += 4;
    });

    // Query matching
    if (query) {
      const lowerQuery = query.toLowerCase();
      if (toolName.includes(lowerQuery)) score += 5;
      if (toolDesc.includes(lowerQuery)) score += 3;
    }

    return { tool, score };
  });

  // Sort by score and return best match
  scoredTools.sort((a, b) => b.score - a.score);

  return scoredTools[0]?.score > 0 ? scoredTools[0].tool : tools[0];
}

// Get intent patterns dynamically
function getIntentPatterns(intent: string): string[] {
  const patterns: Record<string, string[]> = {
    'cryptocurrency_price_query': ['crypto', 'exchange', 'rate', 'price', 'bitcoin', 'btc', 'coin'],
    'web_search': ['search', 'query', 'find', 'web', 'lookup', 'discover'],
    'weather_query': ['weather', 'forecast', 'temperature', 'climate', 'conditions'],
    'stock_price': ['stock', 'quote', 'price', 'market', 'ticker', 'equity'],
    'news_query': ['news', 'article', 'headline', 'current', 'latest'],
    'translation': ['translate', 'language', 'convert', 'translation'],
    'image_search': ['image', 'picture', 'photo', 'visual'],
  };

  return patterns[intent] || extractPatternFromIntent(intent);
}

// Extract patterns from unknown intents
function extractPatternFromIntent(intent: string): string[] {
  // Split by underscore and filter common words
  const parts = intent.toLowerCase().split(/[_\s]+/);
  const commonWords = ['query', 'get', 'fetch', 'find', 'search'];
  return parts.filter(p => !commonWords.includes(p) && p.length > 2);
}

// Create standardized response
function createResponse(server: any, tool: any, alternatives: any[], metadata: any) {
  const { intent, query, routingTime, startTime, cacheKey } = metadata;

  // Mock response for now - in production, this would call the actual MCP server
  const mockResult = getMockResult(intent, query);

  const response = {
    success: true,
    result: mockResult,
    metadata: {
      server: server.display_name,
      serverId: server.qualified_name,
      tool: tool.name,
      confidence: Math.min(server.relevanceScore / 100, 1.0),
      alternatives: alternatives.slice(0, 2).map(alt => ({
        server: alt.display_name,
        confidence: Math.min(alt.relevanceScore / 100, 1.0)
      })),
      routingTime: `${routingTime}ms`,
      executionTime: `0ms`, // Would be actual execution time
      totalTime: `${Date.now() - startTime}ms`,
      cached: false
    }
  };

  // Cache the response
  routeCache.set(cacheKey, {
    data: response,
    timestamp: Date.now()
  });

  // Clean old cache entries
  if (routeCache.size > 1000) {
    const now = Date.now();
    for (const [key, value] of routeCache.entries()) {
      if (now - value.timestamp > CACHE_TTL) {
        routeCache.delete(key);
      }
    }
  }

  return Response.json(response);
}

// Mock results for testing
function getMockResult(intent: string, query: string) {
  const results: Record<string, any> = {
    'cryptocurrency_price_query': {
      symbol: "BTC",
      price: "$43,250",
      change_24h: "+2.3%",
      volume_24h: "$28.5B",
      market_cap: "$846B",
      timestamp: new Date().toISOString()
    },
    'web_search': {
      query: query,
      results: [
        { title: `${query} - Wikipedia`, url: "https://wikipedia.org", snippet: "Comprehensive information..." },
        { title: `Latest ${query} news`, url: "https://news.com", snippet: "Breaking news about..." }
      ],
      total: 1420000
    },
    'weather_query': {
      location: query || "Current Location",
      temperature: "72°F / 22°C",
      condition: "Partly Cloudy",
      humidity: "45%",
      wind: "12 mph NW",
      forecast: "Clear skies expected"
    },
    'stock_price': {
      symbol: query?.toUpperCase() || "AAPL",
      price: "$150.25",
      change: "-$0.75 (-0.5%)",
      volume: "52.3M",
      market_cap: "$2.4T",
      pe_ratio: "28.5"
    }
  };

  return results[intent] || {
    answer: `Processed query: ${query}`,
    status: "success",
    timestamp: new Date().toISOString()
  };
}

// GET endpoint for testing
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const intent = searchParams.get('intent') || '';
  const query = searchParams.get('query') || '';
  const capabilities = searchParams.get('capabilities')?.split(',') || [];
  const category = searchParams.get('category') || '';
  const requireVerified = searchParams.get('requireVerified') === 'true';

  return POST(new NextRequest(request.url, {
    method: 'POST',
    body: JSON.stringify({ intent, query, capabilities, category, requireVerified }),
    headers: { 'Content-Type': 'application/json' }
  }));
}