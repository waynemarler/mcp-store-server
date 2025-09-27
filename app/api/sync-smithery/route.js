// API endpoint to sync MCP servers from Smithery registry
import { NextResponse } from 'next/server';
import SmitheryAPIService from '@/lib/smithery-api-service';

export async function POST(request) {
  try {
    // Check for API key or admin authentication
    const authHeader = request.headers.get('authorization');
    const adminKey = process.env.ADMIN_API_KEY;

    if (adminKey && authHeader !== `Bearer ${adminKey}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get Smithery API key from environment
    const smitheryApiKey = process.env.SMITHERY_API_KEY;

    if (!smitheryApiKey) {
      return NextResponse.json(
        { error: 'Smithery API key not configured' },
        { status: 500 }
      );
    }

    // Initialize the service
    const smitheryService = new SmitheryAPIService(smitheryApiKey);

    // Start sync process (this could take a while)
    // In production, you might want to use a background job queue
    const result = await smitheryService.syncAllServers((progress) => {
      console.log(`Sync progress: ${progress.current}/${progress.total} (Page ${progress.page}/${progress.totalPages})`);
    });

    return NextResponse.json({
      success: true,
      message: `Successfully synced ${result.totalSynced} servers from Smithery`,
      totalSynced: result.totalSynced,
      errors: result.errors.length,
      errorDetails: result.errors.slice(0, 10) // Return first 10 errors if any
    });

  } catch (error) {
    console.error('Sync endpoint error:', error);
    return NextResponse.json(
      {
        error: 'Failed to sync servers',
        message: error.message
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check sync status
export async function GET(request) {
  try {
    const { sql } = await import('@vercel/postgres');

    const result = await sql`
      SELECT * FROM sync_status
      WHERE source = 'smithery'
      ORDER BY updated_at DESC
      LIMIT 1;
    `;

    if (result.rows.length === 0) {
      return NextResponse.json({
        status: 'never_synced',
        message: 'Smithery servers have never been synced'
      });
    }

    const syncStatus = result.rows[0];

    // Get count of synced servers
    const countResult = await sql`
      SELECT COUNT(*) as count
      FROM smithery_mcp_servers;
    `;

    return NextResponse.json({
      status: syncStatus.status,
      lastSyncAt: syncStatus.last_sync_at,
      totalServers: parseInt(countResult.rows[0].count),
      lastPage: syncStatus.last_page,
      errorMessage: syncStatus.error_message
    });

  } catch (error) {
    console.error('Error fetching sync status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sync status' },
      { status: 500 }
    );
  }
}