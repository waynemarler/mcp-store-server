import { NextRequest } from "next/server";
import { sql } from '@vercel/postgres';

// Ultra-fast AI agent routing endpoint
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { intent, query, capabilities = [], category } = body;

    // Start timer for performance monitoring
    const startTime = Date.now();

    // Build optimized query for AI agent routing
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    // Category matching (exact or fuzzy)
    if (category) {
      whereClause += ` AND (category ILIKE $${params.length + 1} OR category ILIKE $${params.length + 2})`;
      params.push(`%${category}%`, category);
    }

    // Capability matching from tools JSON
    if (capabilities.length > 0) {
      const capabilityConditions = capabilities.map((cap, index) =>
        `tools::text ILIKE $${params.length + index + 1}`
      );
      capabilities.forEach(cap => params.push(`%${cap}%`));
      whereClause += ` AND (${capabilityConditions.join(' OR ')})`;
    }

    // Text search across multiple fields
    if (query) {
      const queryParam = `%${query}%`;
      whereClause += ` AND (
        display_name ILIKE $${params.length + 1} OR
        description ILIKE $${params.length + 1} OR
        tools::text ILIKE $${params.length + 1} OR
        tags::text ILIKE $${params.length + 1}
      )`;
      params.push(queryParam);
    }

    // Execute ultra-fast query with proper indexing
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
        use_count,
        author,
        repository_url,
        homepage
      FROM smithery_mcp_servers
      ${whereClause}
      AND security_scan_passed = true
      ORDER BY
        use_count DESC,
        CASE WHEN security_scan_passed THEN 1 ELSE 0 END DESC
      LIMIT 5
    `;

    const result = await sql.query(queryText, params);
    const endTime = Date.now();
    const queryTime = endTime - startTime;

    // Transform results for AI agent consumption
    const routes = result.rows.map(row => ({
      serverId: row.qualified_name,
      serverName: row.display_name,
      description: row.description,
      category: row.category,
      endpoint: row.deployment_url || row.homepage,
      tools: typeof row.tools === 'string' ? JSON.parse(row.tools) : row.tools,
      isRemote: row.is_remote,
      verified: row.security_scan_passed,
      useCount: row.use_count,
      author: row.author,
      repositoryUrl: row.repository_url,
      confidence: calculateConfidence(row, { intent, query, capabilities, category })
    }));

    // Return best matching server for AI routing
    return Response.json({
      success: true,
      queryTime: `${queryTime}ms`,
      totalMatches: result.rows.length,
      bestRoute: routes[0] || null,
      alternativeRoutes: routes.slice(1),
      routing: {
        intent,
        query,
        capabilities,
        category,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error('AI routing error:', error);
    return Response.json({
      success: false,
      error: error.message,
      queryTime: '0ms'
    }, { status: 500 });
  }
}

// Calculate confidence score for AI routing
function calculateConfidence(server: any, searchParams: any): number {
  let confidence = 0;

  // Base confidence from use count (normalized)
  confidence += Math.min(server.use_count / 100, 0.3);

  // Security verification bonus
  if (server.security_scan_passed) {
    confidence += 0.2;
  }

  // Category match bonus
  if (searchParams.category && server.category?.toLowerCase().includes(searchParams.category.toLowerCase())) {
    confidence += 0.3;
  }

  // Query match in description bonus
  if (searchParams.query && server.description?.toLowerCase().includes(searchParams.query.toLowerCase())) {
    confidence += 0.2;
  }

  return Math.min(confidence, 1.0);
}

// GET endpoint for testing AI routing
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const intent = searchParams.get('intent') || '';
  const query = searchParams.get('query') || '';
  const capabilities = searchParams.get('capabilities')?.split(',') || [];
  const category = searchParams.get('category') || '';

  // Forward to POST handler
  return POST(new NextRequest(request.url, {
    method: 'POST',
    body: JSON.stringify({ intent, query, capabilities, category }),
    headers: { 'Content-Type': 'application/json' }
  }));
}