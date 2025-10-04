import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function GET(request: NextRequest) {
  try {
    console.log('🚀 Starting semantic data population...');

    // First, add the semantic columns if they don't exist
    console.log('📝 Adding semantic columns...');
    try {
      await sql`
        ALTER TABLE capabilities
        ADD COLUMN IF NOT EXISTS intent_category VARCHAR(50),
        ADD COLUMN IF NOT EXISTS semantic_tags TEXT[],
        ADD COLUMN IF NOT EXISTS context_type VARCHAR(50)
      `;
      console.log('✅ Semantic columns added successfully');
    } catch (error: any) {
      console.log('⚠️ Columns might already exist:', error.message);
    }

    // Create indexes
    console.log('📝 Creating indexes...');
    await sql`CREATE INDEX IF NOT EXISTS idx_capabilities_intent_category ON capabilities(intent_category)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_capabilities_semantic_tags ON capabilities USING GIN(semantic_tags)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_capabilities_context_type ON capabilities(context_type)`;

    // Populate genuine time capabilities
    console.log('📝 Categorizing genuine time capabilities...');

    // Current time capabilities
    const timeCapabilities = await sql`
      UPDATE capabilities
      SET
          intent_category = 'time_query',
          semantic_tags = ARRAY['time', 'current', 'now'],
          context_type = 'current_time'
      WHERE capability_name IN (
          'current_time',
          'get_current_time',
          'get_current_datetime',
          'get_time',
          'time'
      )
      RETURNING capability_name
    `;
    console.log(`✅ Updated ${timeCapabilities.rowCount} current time capabilities`);

    // Time conversion capabilities
    const conversionCapabilities = await sql`
      UPDATE capabilities
      SET
          intent_category = 'time_query',
          semantic_tags = ARRAY['time', 'conversion', 'timezone'],
          context_type = 'time_conversion'
      WHERE capability_name IN (
          'convert_time',
          'timezone_lookup',
          'get_timestamp'
      )
      RETURNING capability_name
    `;
    console.log(`✅ Updated ${conversionCapabilities.rowCount} time conversion capabilities`);

    // Relative time capabilities
    const relativeCapabilities = await sql`
      UPDATE capabilities
      SET
          intent_category = 'time_query',
          semantic_tags = ARRAY['time', 'relative', 'calculation'],
          context_type = 'relative_time'
      WHERE capability_name IN (
          'relative_time',
          'days_in_month',
          'get_week_year'
      )
      RETURNING capability_name
    `;
    console.log(`✅ Updated ${relativeCapabilities.rowCount} relative time capabilities`);

    // Mark financial time series as NOT time_query
    const financialCapabilities = await sql`
      UPDATE capabilities
      SET
          intent_category = 'financial_data',
          semantic_tags = ARRAY['finance', 'historical', 'data', 'series'],
          context_type = 'time_series'
      WHERE (capability_name LIKE '%time_series%' OR capability_name LIKE '%TimeSeries%')
      AND intent_category IS NULL
      RETURNING capability_name
    `;
    console.log(`✅ Updated ${financialCapabilities.rowCount} financial time series capabilities`);

    // Mark project management time tracking as NOT time_query
    const projectCapabilities = await sql`
      UPDATE capabilities
      SET
          intent_category = 'project_management',
          semantic_tags = ARRAY['tracking', 'productivity', 'tasks', 'management'],
          context_type = 'time_tracking'
      WHERE (capability_name LIKE '%time_tracking%' OR capability_name LIKE '%time_entry%' OR capability_name LIKE '%timeEntry%')
      AND intent_category IS NULL
      RETURNING capability_name
    `;
    console.log(`✅ Updated ${projectCapabilities.rowCount} project management capabilities`);

    // Mark realtime data streams as NOT time_query
    const realtimeCapabilities = await sql`
      UPDATE capabilities
      SET
          intent_category = 'data_streaming',
          semantic_tags = ARRAY['streaming', 'live', 'data', 'realtime'],
          context_type = 'realtime_data'
      WHERE (capability_name LIKE '%realtime%' OR capability_name LIKE '%real_time%')
      AND intent_category IS NULL
      RETURNING capability_name
    `;
    console.log(`✅ Updated ${realtimeCapabilities.rowCount} realtime data capabilities`);

    // Add book/literature capabilities
    const bookCapabilities = await sql`
      UPDATE capabilities
      SET
          intent_category = 'book_query',
          semantic_tags = ARRAY['books', 'literature', 'reading', 'authors'],
          context_type = 'book_search'
      WHERE capability_name IN (
          'book_search',
          'author_search',
          'search_books_tool',
          'list_books',
          'get_book_summary',
          'get_book_details',
          'get_book_by_title',
          'get_authors_by_name'
      )
      AND intent_category IS NULL
      RETURNING capability_name
    `;
    console.log(`✅ Updated ${bookCapabilities.rowCount} book capabilities`);

    // Verification queries
    console.log('📊 Running verification queries...');

    const verificationResult = await sql`
      SELECT
          intent_category,
          context_type,
          COUNT(*) as capability_count
      FROM capabilities
      WHERE intent_category IS NOT NULL
      GROUP BY intent_category, context_type
      ORDER BY intent_category, context_type
    `;

    const timeQueryResult = await sql`
      SELECT capability_name, semantic_tags, context_type
      FROM capabilities
      WHERE intent_category = 'time_query'
      ORDER BY context_type, capability_name
    `;

    // Check server-capability connections
    const serverConnectionsResult = await sql`
      SELECT DISTINCT s.id, s.qualified_name, s.display_name
      FROM smithery_mcp_servers s
      JOIN server_capabilities sc ON s.id = sc.server_id::VARCHAR
      JOIN capabilities c ON sc.capability_id = c.id
      WHERE c.intent_category = 'time_query'
      AND s.security_scan_passed = true
      ORDER BY s.id
      LIMIT 10
    `;

    console.log('✅ Semantic data population completed successfully!');

    return NextResponse.json({
      success: true,
      message: 'Semantic data populated successfully',
      summary: {
        categories_populated: verificationResult.rows,
        time_query_capabilities: timeQueryResult.rows,
        servers_with_time_capabilities: serverConnectionsResult.rows,
        total_updates: {
          time_capabilities: timeCapabilities.rowCount,
          conversion_capabilities: conversionCapabilities.rowCount,
          relative_capabilities: relativeCapabilities.rowCount,
          financial_capabilities: financialCapabilities.rowCount,
          project_capabilities: projectCapabilities.rowCount,
          realtime_capabilities: realtimeCapabilities.rowCount,
          book_capabilities: bookCapabilities.rowCount
        }
      }
    });

  } catch (error: any) {
    console.error('❌ Semantic data population failed:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}