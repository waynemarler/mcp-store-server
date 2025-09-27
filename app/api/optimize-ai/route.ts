import { NextRequest } from "next/server";
import { sql } from '@vercel/postgres';

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Creating ultra-fast AI routing indexes...');

    // 1. Composite index for AI routing queries (category + security + use_count)
    await sql`
      CREATE INDEX IF NOT EXISTS idx_ai_routing_composite
      ON smithery_mcp_servers (category, security_scan_passed, use_count DESC)
    `;

    // 2. Text search index for tools JSON field
    await sql`
      CREATE INDEX IF NOT EXISTS idx_ai_tools_gin
      ON smithery_mcp_servers USING GIN (tools)
    `;

    // 3. Text search index for tags array
    await sql`
      CREATE INDEX IF NOT EXISTS idx_ai_tags_gin
      ON smithery_mcp_servers USING GIN (tags)
    `;

    // 4. Full text search index for description
    await sql`
      CREATE INDEX IF NOT EXISTS idx_ai_description_fulltext
      ON smithery_mcp_servers USING GIN (to_tsvector('english', description))
    `;

    // 5. Partial index for verified servers only (AI prefers verified)
    await sql`
      CREATE INDEX IF NOT EXISTS idx_ai_verified_servers
      ON smithery_mcp_servers (use_count DESC, category)
      WHERE security_scan_passed = true
    `;

    // 6. Index for remote servers (different routing logic)
    await sql`
      CREATE INDEX IF NOT EXISTS idx_ai_remote_servers
      ON smithery_mcp_servers (is_remote, deployment_url)
      WHERE deployment_url IS NOT NULL
    `;

    // 7. Multi-column index for category-based routing
    await sql`
      CREATE INDEX IF NOT EXISTS idx_ai_category_routing
      ON smithery_mcp_servers (category, use_count DESC, security_scan_passed)
    `;

    // 8. Index for author-based routing
    await sql`
      CREATE INDEX IF NOT EXISTS idx_ai_author_routing
      ON smithery_mcp_servers (author, use_count DESC)
      WHERE author IS NOT NULL
    `;

    console.log('✅ AI routing indexes created successfully!');

    // Test query performance
    console.log('🧪 Testing AI routing query performance...');

    const startTime = Date.now();
    const testResult = await sql`
      SELECT qualified_name, display_name, category, use_count, security_scan_passed
      FROM smithery_mcp_servers
      WHERE category ILIKE '%crypto%'
      AND security_scan_passed = true
      ORDER BY use_count DESC
      LIMIT 5
    `;
    const endTime = Date.now();

    const queryTime = endTime - startTime;
    const topMatch = testResult.rows[0] ? {
      name: testResult.rows[0].display_name,
      category: testResult.rows[0].category,
      useCount: testResult.rows[0].use_count,
      verified: testResult.rows[0].security_scan_passed
    } : null;

    return Response.json({
      success: true,
      message: 'AI routing optimization complete',
      indexesCreated: 8,
      testQuery: {
        executionTime: `${queryTime}ms`,
        matchesFound: testResult.rows.length,
        topMatch
      },
      performance: queryTime < 50 ? 'EXCELLENT' : queryTime < 100 ? 'GOOD' : 'NEEDS_OPTIMIZATION'
    });

  } catch (error: any) {
    console.error('❌ Error optimizing AI indexes:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  // Forward GET to POST for easy testing
  return POST(request);
}