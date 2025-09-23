import { NextRequest } from 'next/server';
import { GitHubDiscoveryService } from '@/lib/github/discovery';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const page = parseInt(searchParams.get('page') || '1');
    const per_page = parseInt(searchParams.get('per_page') || '20');
    const analyze = searchParams.get('analyze') === 'true';

    const discoveryService = new GitHubDiscoveryService();

    console.log('🔍 GitHub Discovery Request:', {
      query: query || 'default MCP search',
      page,
      per_page,
      analyze
    });

    // Search for repositories
    const repositories = await discoveryService.searchMCPRepositories({
      query: query || undefined,
      page,
      per_page
    });

    if (!analyze) {
      // Just return the repository list
      return Response.json({
        success: true,
        repositories,
        meta: {
          total: repositories.length,
          page,
          per_page
        }
      });
    }

    // Analyze repositories for MCP servers
    console.log(`📊 Analyzing ${repositories.length} repositories for MCP servers...`);
    const candidates = await discoveryService.batchAnalyzeRepositories(repositories);

    console.log(`✅ Found ${candidates.length} MCP server candidates`);

    return Response.json({
      success: true,
      candidates,
      meta: {
        total_repositories: repositories.length,
        mcp_candidates: candidates.length,
        page,
        per_page,
        detection_rate: repositories.length > 0 ? (candidates.length / repositories.length * 100).toFixed(1) : '0'
      }
    });

  } catch (error: any) {
    console.error('GitHub discovery error:', error);
    return Response.json({
      success: false,
      error: error.message,
      message: 'Failed to discover GitHub repositories'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { owner, repo } = body;

    if (!owner || !repo) {
      return Response.json({
        success: false,
        error: 'Missing required fields: owner, repo'
      }, { status: 400 });
    }

    const discoveryService = new GitHubDiscoveryService();

    console.log(`🔍 Analyzing specific repository: ${owner}/${repo}`);

    const candidate = await discoveryService.detectMCPServer(owner, repo);

    if (!candidate) {
      return Response.json({
        success: false,
        message: 'No MCP server detected in this repository',
        confidence: 0
      });
    }

    console.log(`✅ MCP server detected with ${(candidate.detection.confidence * 100).toFixed(1)}% confidence`);

    return Response.json({
      success: true,
      candidate,
      meta: {
        confidence: candidate.detection.confidence,
        indicators: candidate.detection.indicators,
        has_manifest: candidate.detection.hasManifest
      }
    });

  } catch (error: any) {
    console.error('Repository analysis error:', error);
    return Response.json({
      success: false,
      error: error.message,
      message: 'Failed to analyze repository'
    }, { status: 500 });
  }
}