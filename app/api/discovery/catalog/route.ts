import { NextRequest } from 'next/server';
import { discoveredServerStore } from '@/lib/discovery/discovered-store';
import { GitHubDiscoveryService } from '@/lib/github/discovery';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as 'discovered' | 'contacted' | 'approved' | 'rejected' | null;
    const minConfidence = parseFloat(searchParams.get('minConfidence') || '0');
    const minStars = parseInt(searchParams.get('minStars') || '0');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    console.log('📊 Discovery Catalog Request:', {
      status: status || 'all',
      minConfidence,
      minStars,
      limit,
      offset
    });

    const servers = await discoveredServerStore.getDiscoveredServers({
      status: status || undefined,
      minConfidence,
      minStars,
      limit,
      offset
    });

    const stats = await discoveredServerStore.getDiscoveryStats();

    console.log(`✅ Retrieved ${servers.length} discovered servers`);

    return Response.json({
      success: true,
      servers,
      stats,
      meta: {
        total: stats.total,
        returned: servers.length,
        offset,
        limit,
        filters: {
          status: status || 'all',
          minConfidence,
          minStars
        }
      }
    });

  } catch (error: any) {
    console.error('Discovery catalog error:', error);
    return Response.json({
      success: false,
      error: error.message,
      message: 'Failed to get discovery catalog'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'scan_and_store':
        return await handleScanAndStore(body);
      case 'update_status':
        return await handleUpdateStatus(body);
      case 'record_contact':
        return await handleRecordContact(body);
      default:
        return Response.json({
          success: false,
          error: 'Unknown action'
        }, { status: 400 });
    }

  } catch (error: any) {
    console.error('Discovery catalog POST error:', error);
    return Response.json({
      success: false,
      error: error.message,
      message: 'Failed to process discovery catalog request'
    }, { status: 500 });
  }
}

async function handleScanAndStore(body: any) {
  const { query, limit = 20 } = body;

  console.log('🔍 Scanning GitHub and storing discovered servers...');

  const discoveryService = new GitHubDiscoveryService();

  // Search for repositories
  const repositories = await discoveryService.searchMCPRepositories({
    query: query || undefined,
    per_page: limit
  });

  console.log(`📊 Found ${repositories.length} repositories to analyze`);

  // Analyze repositories for MCP servers
  const candidates = await discoveryService.batchAnalyzeRepositories(repositories);

  console.log(`🎯 Detected ${candidates.length} MCP server candidates`);

  // Store discovered servers
  const storedIds = await discoveredServerStore.batchStoreDiscoveredServers(candidates);

  console.log(`💾 Stored ${storedIds.length} discovered servers`);

  return Response.json({
    success: true,
    message: 'Scan and store completed',
    results: {
      repositoriesSearched: repositories.length,
      candidatesDetected: candidates.length,
      serversStored: storedIds.length,
      storedIds
    }
  });
}

async function handleUpdateStatus(body: any) {
  const { serverId, status, metadata } = body;

  if (!serverId || !status) {
    return Response.json({
      success: false,
      error: 'Missing required fields: serverId, status'
    }, { status: 400 });
  }

  await discoveredServerStore.updateServerStatus(serverId, status, metadata);

  return Response.json({
    success: true,
    message: `Server ${serverId} status updated to ${status}`
  });
}

async function handleRecordContact(body: any) {
  const { serverId, method, template, successful, response } = body;

  if (!serverId || !method || !template) {
    return Response.json({
      success: false,
      error: 'Missing required fields: serverId, method, template'
    }, { status: 400 });
  }

  await discoveredServerStore.recordContactAttempt(serverId, {
    method,
    sentAt: new Date(),
    template,
    successful: successful || false,
    response,
    responseAt: response ? new Date() : undefined
  });

  // Update server status to 'contacted' if this is the first contact
  const server = await discoveredServerStore.getDiscoveredServer(serverId);
  if (server && server.status === 'discovered') {
    await discoveredServerStore.updateServerStatus(serverId, 'contacted');
  }

  return Response.json({
    success: true,
    message: `Contact attempt recorded for ${serverId}`
  });
}