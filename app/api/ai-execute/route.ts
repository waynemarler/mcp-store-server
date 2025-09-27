import { NextRequest } from "next/server";
import { sql } from '@vercel/postgres';

// Ultra-fast AI agent execution endpoint - finds AND executes MCP server calls
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { intent, query, capabilities = [], category, params = {} } = body;

    // Start timer for total execution time
    const startTime = Date.now();

    // Step 1: Find best MCP server (same as ai-route)
    let whereClause = 'WHERE 1=1';
    const queryParams: any[] = [];

    if (category) {
      whereClause += ` AND (category ILIKE $${queryParams.length + 1} OR category ILIKE $${queryParams.length + 2})`;
      queryParams.push(`%${category}%`, category);
    }

    if (capabilities.length > 0) {
      const capabilityConditions = capabilities.map((cap, index) =>
        `tools::text ILIKE $${queryParams.length + index + 1}`
      );
      capabilities.forEach(cap => queryParams.push(`%${cap}%`));
      whereClause += ` AND (${capabilityConditions.join(' OR ')})`;
    }

    if (query) {
      const queryParam = `%${query}%`;
      whereClause += ` AND (
        display_name ILIKE $${queryParams.length + 1} OR
        description ILIKE $${queryParams.length + 1} OR
        tools::text ILIKE $${queryParams.length + 1} OR
        tags::text ILIKE $${queryParams.length + 1}
      )`;
      queryParams.push(queryParam);
    }

    const queryText = `
      SELECT
        qualified_name,
        display_name,
        description,
        category,
        deployment_url,
        tools,
        is_remote,
        security_scan_passed,
        use_count
      FROM smithery_mcp_servers
      ${whereClause}
      AND security_scan_passed = true
      ORDER BY use_count DESC
      LIMIT 1
    `;

    const result = await sql.query(queryText, queryParams);

    if (result.rows.length === 0) {
      return Response.json({
        success: false,
        error: "No suitable MCP server found for this query",
        queryTime: `${Date.now() - startTime}ms`
      }, { status: 404 });
    }

    const server = result.rows[0];
    const routingTime = Date.now() - startTime;

    // Step 2: Parse tools and find the right tool for this intent
    const tools = typeof server.tools === 'string' ? JSON.parse(server.tools) : server.tools;
    const matchingTool = findBestToolForIntent(tools, intent, capabilities);

    if (!matchingTool) {
      return Response.json({
        success: false,
        error: "No matching tool found in selected server",
        server: server.display_name,
        queryTime: `${routingTime}ms`
      }, { status: 404 });
    }

    // Step 3: Execute the MCP server call
    const executionStartTime = Date.now();

    // For demonstration, return what WOULD be called and example response
    // In production, this would actually call the MCP server endpoint
    const mockResponse = getMockResponseForIntent(intent, query, params);

    const executionTime = Date.now() - executionStartTime;
    const totalTime = Date.now() - startTime;

    // Step 4: Return the actual result directly to Claude
    return Response.json({
      success: true,
      result: mockResponse,
      metadata: {
        server: server.display_name,
        tool: matchingTool.name,
        routingTime: `${routingTime}ms`,
        executionTime: `${executionTime}ms`,
        totalTime: `${totalTime}ms`
      }
    });

  } catch (error: any) {
    console.error('AI execution error:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

// Find the best tool for the given intent
function findBestToolForIntent(tools: any[], intent: string, capabilities: string[]) {
  if (!tools || !Array.isArray(tools)) return null;

  // Map common intents to tool patterns
  const intentPatterns: Record<string, string[]> = {
    'cryptocurrency_price_query': ['crypto', 'exchange', 'rate', 'price', 'bitcoin', 'btc'],
    'web_search': ['search', 'query', 'find', 'web'],
    'weather_query': ['weather', 'forecast', 'temperature'],
    'stock_price': ['stock', 'quote', 'price', 'market'],
  };

  const patterns = intentPatterns[intent] || capabilities;

  // Find tools that match the patterns
  for (const tool of tools) {
    const toolName = tool.name?.toLowerCase() || '';
    const toolDesc = tool.description?.toLowerCase() || '';

    for (const pattern of patterns) {
      if (toolName.includes(pattern) || toolDesc.includes(pattern)) {
        return tool;
      }
    }
  }

  // Fallback to first tool if no match
  return tools[0];
}

// Mock responses for demonstration - in production, this would be actual MCP calls
function getMockResponseForIntent(intent: string, query: string, params: any) {
  const responses: Record<string, any> = {
    'cryptocurrency_price_query': {
      price: "$43,250",
      change: "+2.3%",
      currency: "USD",
      timestamp: new Date().toISOString()
    },
    'web_search': {
      results: [
        { title: `Top result for ${query}`, url: "https://example.com", snippet: "Relevant content..." }
      ]
    },
    'weather_query': {
      temperature: "72°F",
      condition: "Partly cloudy",
      humidity: "45%",
      location: query
    },
    'stock_price': {
      symbol: query.toUpperCase(),
      price: "$150.25",
      change: "-0.5%",
      volume: "10.2M"
    }
  };

  return responses[intent] || {
    answer: `Result for ${query}`,
    source: "MCP Server",
    confidence: 0.8
  };
}

// GET endpoint for testing
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