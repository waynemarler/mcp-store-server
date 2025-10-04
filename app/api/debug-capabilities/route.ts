import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Debugging capabilities table...');

    // Get total count of capabilities
    const totalResult = await sql`
      SELECT COUNT(*) as total_count
      FROM capabilities
    `;

    // Get sample capabilities with time in name
    const timeCapabilitiesResult = await sql`
      SELECT capability_name, id
      FROM capabilities
      WHERE capability_name ILIKE '%time%'
      ORDER BY capability_name
      LIMIT 20
    `;

    // Get sample capabilities with current in name
    const currentCapabilitiesResult = await sql`
      SELECT capability_name, id
      FROM capabilities
      WHERE capability_name ILIKE '%current%'
      ORDER BY capability_name
      LIMIT 10
    `;

    // Get completely random sample of capabilities
    const randomCapabilitiesResult = await sql`
      SELECT capability_name, id
      FROM capabilities
      ORDER BY RANDOM()
      LIMIT 20
    `;

    // Check if semantic columns have any data
    const semanticDataResult = await sql`
      SELECT
        COUNT(*) as total_with_categories,
        COUNT(intent_category) as categorized_count
      FROM capabilities
      WHERE intent_category IS NOT NULL
    `;

    return NextResponse.json({
      success: true,
      summary: {
        total_capabilities: totalResult.rows[0]?.total_count || 0,
        time_capabilities: timeCapabilitiesResult.rows,
        current_capabilities: currentCapabilitiesResult.rows,
        random_sample: randomCapabilitiesResult.rows,
        semantic_data: semanticDataResult.rows[0]
      }
    });

  } catch (error: any) {
    console.error('❌ Debug capabilities failed:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}