import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Testing semantic query system...');

    // First, check if columns exist
    const columnsResult = await sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'capabilities'
      AND column_name IN ('intent_category', 'semantic_tags', 'context_type')
    `;

    console.log('📋 Available semantic columns:', columnsResult.rows.map(r => r.column_name));

    // Test direct SQL query to see if we can find time-related capabilities
    console.log('🔍 Searching for time-related capabilities...');

    // Method 1: Look for capabilities that contain time-related keywords
    const timeCapabilitiesResult = await sql`
      SELECT capability_name, id
      FROM capabilities
      WHERE capability_name ILIKE '%time%'
         OR capability_name ILIKE '%clock%'
         OR capability_name ILIKE '%datetime%'
      ORDER BY capability_name
      LIMIT 20
    `;

    console.log(`📊 Found ${timeCapabilitiesResult.rows.length} time-related capabilities`);

    // Method 2: Try to find servers with time capabilities
    const timeServersResult = await sql`
      SELECT DISTINCT s.id, s.qualified_name, s.display_name, c.capability_name
      FROM smithery_mcp_servers s
      JOIN server_capabilities sc ON s.id = sc.server_id::VARCHAR
      JOIN capabilities c ON sc.capability_id = c.id
      WHERE (c.capability_name ILIKE '%current_time%'
             OR c.capability_name ILIKE '%get_time%'
             OR c.capability_name ILIKE '%datetime%')
        AND s.security_scan_passed = true
      ORDER BY s.id
      LIMIT 10
    `;

    console.log(`📊 Found ${timeServersResult.rows.length} servers with genuine time capabilities`);

    // Method 3: Count all servers that would match our current string-based filtering
    const allTimeServersResult = await sql`
      SELECT DISTINCT s.id, s.qualified_name, s.display_name,
             array_agg(c.capability_name) as capabilities
      FROM smithery_mcp_servers s
      JOIN server_capabilities sc ON s.id = sc.server_id::VARCHAR
      JOIN capabilities c ON sc.capability_id = c.id
      WHERE c.capability_name ILIKE '%time%'
        AND s.security_scan_passed = true
      GROUP BY s.id, s.qualified_name, s.display_name
      ORDER BY s.id
      LIMIT 20
    `;

    console.log(`📊 Found ${allTimeServersResult.rows.length} servers with ANY time-related capabilities (includes false positives)`);

    return NextResponse.json({
      success: true,
      summary: {
        semantic_columns_available: columnsResult.rows.map(r => r.column_name),
        genuine_time_capabilities: timeCapabilitiesResult.rows,
        servers_with_genuine_time: timeServersResult.rows,
        servers_with_any_time: allTimeServersResult.rows,
        analysis: {
          problem: `Current string matching returns ${allTimeServersResult.rows.length} servers with ANY 'time' in capabilities`,
          solution: `Semantic categorization would return only ${timeServersResult.rows.length} servers with genuine time capabilities`,
          improvement: `${allTimeServersResult.rows.length - timeServersResult.rows.length} false positives eliminated`
        }
      }
    });

  } catch (error: any) {
    console.error('❌ Semantic query test failed:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}