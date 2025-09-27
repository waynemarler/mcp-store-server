import { NextRequest } from "next/server";
import { sql } from '@vercel/postgres';

export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Setting up sync infrastructure...');

    // Create sync_status table
    await sql`
      CREATE TABLE IF NOT EXISTS sync_status (
        id SERIAL PRIMARY KEY,
        source VARCHAR(50) UNIQUE NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        last_sync_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_page INTEGER DEFAULT 0,
        total_servers INTEGER DEFAULT 0,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // Insert initial smithery status
    await sql`
      INSERT INTO sync_status (source, status, total_servers)
      VALUES ('smithery', 'ready', 0)
      ON CONFLICT (source) DO NOTHING;
    `;

    // Check current server count
    const result = await sql`SELECT COUNT(*) FROM smithery_mcp_servers`;
    const currentCount = parseInt(result.rows[0].count);

    // Update status with current count
    await sql`
      UPDATE sync_status
      SET total_servers = ${currentCount}
      WHERE source = 'smithery';
    `;

    return Response.json({
      success: true,
      message: 'Sync infrastructure setup complete',
      currentServerCount: currentCount
    });

  } catch (error: any) {
    console.error('Setup error:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

export async function GET() {
  return POST(new NextRequest('http://localhost/setup-sync', { method: 'POST' }));
}