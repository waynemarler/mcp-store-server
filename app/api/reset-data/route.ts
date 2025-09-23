import { sql } from '@vercel/postgres';
import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('🗑️ Clearing all database data...');

    // Clear all data from tables (in correct order due to foreign keys)
    await sql`DELETE FROM server_metrics`;
    await sql`DELETE FROM server_tags`;
    await sql`DELETE FROM server_capabilities`;
    await sql`DELETE FROM server_categories`;
    await sql`DELETE FROM mcp_servers`;
    await sql`DELETE FROM tags`;
    await sql`DELETE FROM capabilities`;
    await sql`DELETE FROM categories`;
    await sql`DELETE FROM authors`;

    // Reset sequences to start from 1
    await sql`ALTER SEQUENCE authors_id_seq RESTART WITH 1`;
    await sql`ALTER SEQUENCE categories_id_seq RESTART WITH 1`;
    await sql`ALTER SEQUENCE capabilities_id_seq RESTART WITH 1`;
    await sql`ALTER SEQUENCE tags_id_seq RESTART WITH 1`;
    await sql`ALTER SEQUENCE server_metrics_id_seq RESTART WITH 1`;

    console.log('✅ All data cleared successfully');

    return Response.json({
      success: true,
      message: 'Database cleared successfully',
      details: {
        tablesCleared: [
          'server_metrics',
          'server_tags',
          'server_capabilities',
          'server_categories',
          'mcp_servers',
          'tags',
          'capabilities',
          'categories',
          'authors'
        ],
        sequencesReset: 5,
        status: 'Database is now clean and ready for fresh data'
      }
    });

  } catch (error: any) {
    console.error('Failed to clear database:', error.message);
    return Response.json({
      success: false,
      error: error.message,
      message: 'Failed to clear database'
    }, { status: 500 });
  }
}