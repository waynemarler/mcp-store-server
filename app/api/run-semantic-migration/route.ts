import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function GET(request: NextRequest) {
  try {
    console.log('🚀 Starting semantic capabilities migration...');

    // Add semantic columns to capabilities table
    console.log('📝 Adding semantic columns...');
    await sql`
      ALTER TABLE capabilities
      ADD COLUMN IF NOT EXISTS intent_category VARCHAR(50),
      ADD COLUMN IF NOT EXISTS semantic_tags TEXT[],
      ADD COLUMN IF NOT EXISTS context_type VARCHAR(50)
    `;

    // Create indexes for fast semantic lookups
    console.log('📝 Creating indexes...');
    await sql`CREATE INDEX IF NOT EXISTS idx_capabilities_intent_category ON capabilities(intent_category)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_capabilities_semantic_tags ON capabilities USING GIN(semantic_tags)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_capabilities_context_type ON capabilities(context_type)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_capabilities_intent_context ON capabilities(intent_category, context_type)`;

    // Populate time-related capabilities
    console.log('📝 Categorizing genuine time capabilities...');

    // Current time capabilities
    await sql`
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
    `;

    // Time conversion capabilities
    await sql`
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
    `;

    // Relative time capabilities
    await sql`
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
    `;

    // Mark financial time series as NOT time_query
    console.log('📝 Categorizing financial time series...');
    await sql`
      UPDATE capabilities
      SET
          intent_category = 'financial_data',
          semantic_tags = ARRAY['finance', 'historical', 'data', 'series'],
          context_type = 'time_series'
      WHERE capability_name LIKE '%time_series%'
         OR capability_name LIKE '%TimeSeries%'
    `;

    // Mark project management time tracking as NOT time_query
    console.log('📝 Categorizing project management time tracking...');
    await sql`
      UPDATE capabilities
      SET
          intent_category = 'project_management',
          semantic_tags = ARRAY['tracking', 'productivity', 'tasks', 'management'],
          context_type = 'time_tracking'
      WHERE capability_name LIKE '%time_tracking%'
         OR capability_name LIKE '%time_entry%'
         OR capability_name LIKE '%timeEntry%'
    `;

    // Mark realtime data streams as NOT time_query
    console.log('📝 Categorizing realtime data streams...');
    await sql`
      UPDATE capabilities
      SET
          intent_category = 'data_streaming',
          semantic_tags = ARRAY['streaming', 'live', 'data', 'realtime'],
          context_type = 'realtime_data'
      WHERE capability_name LIKE '%realtime%'
         OR capability_name LIKE '%real_time%'
    `;

    // Add book/literature capabilities
    console.log('📝 Categorizing book/literature capabilities...');
    await sql`
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
    `;

    // Run verification queries
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

    console.log('✅ Semantic capabilities migration completed successfully!');

    return NextResponse.json({
      success: true,
      message: 'Semantic capabilities migration completed',
      verification: {
        categorization_summary: verificationResult.rows,
        time_query_capabilities: timeQueryResult.rows
      }
    });

  } catch (error: any) {
    console.error('❌ Migration failed:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}