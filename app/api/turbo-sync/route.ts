import { NextRequest } from "next/server";
import { sql } from '@vercel/postgres';

// TURBO SYNC - Pull all 7,000 MCP servers from Smithery with parallel processing
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      batchSize = 10,
      parallelRequests = 3,
      includeUnverified = true,
      startPage = 1
    } = body;

    console.log('🚀 Starting TURBO SYNC for all Smithery servers...');

    const startTime = Date.now();

    // Initialize sync status
    await sql`
      INSERT INTO sync_status (source, status, last_sync_at, total_servers, error_message)
      VALUES ('smithery_turbo', 'syncing', CURRENT_TIMESTAMP, 0, null)
      ON CONFLICT (source) DO UPDATE SET
        status = 'syncing',
        last_sync_at = CURRENT_TIMESTAMP,
        total_servers = 0,
        error_message = null,
        updated_at = CURRENT_TIMESTAMP;
    `;

    // First, get total count
    const initialResponse = await fetchSmitheryPage(1, 1);
    if (!initialResponse.success) {
      throw new Error('Failed to connect to Smithery API');
    }

    const totalCount = initialResponse.data.pagination?.totalCount || 0;
    const totalPages = initialResponse.data.pagination?.totalPages || 0;

    console.log(`📊 Found ${totalCount} total servers across ${totalPages} pages`);

    // Process pages in parallel batches
    let currentPage = startPage;
    let totalSynced = 0;
    let totalErrors = 0;
    const errors = [];
    const stats = {
      verified: 0,
      unverified: 0,
      remote: 0,
      local: 0,
      withTools: 0,
      categories: {}
    };

    while (currentPage <= totalPages) {
      const endPage = Math.min(currentPage + batchSize - 1, totalPages);
      const pagePromises = [];

      // Create parallel page requests
      for (let page = currentPage; page <= endPage; page++) {
        pagePromises.push(processSinglePage(page, includeUnverified));
      }

      try {
        console.log(`⚡ Processing pages ${currentPage}-${endPage} (${pagePromises.length} parallel requests)`);

        const results = await Promise.allSettled(pagePromises);

        // Process results
        for (const result of results) {
          if (result.status === 'fulfilled') {
            totalSynced += result.value.synced;
            totalErrors += result.value.errors.length;
            errors.push(...result.value.errors);

            // Update stats
            result.value.stats.forEach(stat => {
              if (stat.verified) stats.verified++;
              else stats.unverified++;

              if (stat.remote) stats.remote++;
              else stats.local++;

              if (stat.toolCount > 0) stats.withTools++;

              const category = stat.category || 'Uncategorized';
              stats.categories[category] = (stats.categories[category] || 0) + 1;
            });

          } else {
            console.error(`❌ Batch failed:`, result.reason);
            totalErrors++;
            errors.push({ batch: `${currentPage}-${endPage}`, error: result.reason.message });
          }
        }

        // Update progress
        await updateSyncProgress(totalSynced, totalCount, currentPage, totalPages, errors.slice(-5));

        console.log(`✅ Progress: ${totalSynced}/${totalCount} servers (${((totalSynced/totalCount)*100).toFixed(1)}%)`);
        console.log(`📈 Stats: ✓${stats.verified} ❌${stats.unverified} 🌐${stats.remote} 💻${stats.local} 🔧${stats.withTools}`);

      } catch (batchError) {
        console.error(`❌ Batch error for pages ${currentPage}-${endPage}:`, batchError);
        totalErrors++;
        errors.push({ batch: `${currentPage}-${endPage}`, error: batchError.message });
      }

      currentPage = endPage + 1;

      // Small delay between batches to avoid overwhelming the API
      if (currentPage <= totalPages) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    const totalTime = Date.now() - startTime;

    // Final status update
    await sql`
      UPDATE sync_status SET
        status = ${totalErrors > totalSynced * 0.1 ? 'completed_with_errors' : 'completed'},
        total_servers = ${totalSynced},
        last_page = ${totalPages},
        error_message = ${errors.length > 0 ? JSON.stringify(errors.slice(-10)) : null},
        updated_at = CURRENT_TIMESTAMP
      WHERE source = 'smithery_turbo';
    `;

    console.log(`🎉 TURBO SYNC COMPLETE!`);
    console.log(`📊 ${totalSynced} servers synced in ${(totalTime/1000).toFixed(1)}s`);
    console.log(`⚡ ${(totalSynced/(totalTime/1000)).toFixed(1)} servers/second`);

    return Response.json({
      success: true,
      summary: {
        totalServers: totalSynced,
        totalTime: `${(totalTime/1000).toFixed(1)}s`,
        serversPerSecond: (totalSynced/(totalTime/1000)).toFixed(1),
        totalPages: totalPages,
        errors: totalErrors,
        errorRate: `${((totalErrors/totalCount)*100).toFixed(2)}%`
      },
      stats: {
        verified: stats.verified,
        unverified: stats.unverified,
        remote: stats.remote,
        local: stats.local,
        withTools: stats.withTools,
        categories: Object.entries(stats.categories)
          .sort(([,a], [,b]) => (b as number) - (a as number))
          .slice(0, 10)
          .map(([cat, count]) => ({ category: cat, count }))
      },
      performance: {
        batchSize,
        parallelRequests,
        totalBatches: Math.ceil(totalPages / batchSize),
        avgBatchTime: `${(totalTime / Math.ceil(totalPages / batchSize)).toFixed(0)}ms`
      },
      recentErrors: errors.slice(-5)
    });

  } catch (error: any) {
    console.error('💥 TURBO SYNC FAILED:', error);

    // Update status to failed
    await sql`
      UPDATE sync_status SET
        status = 'failed',
        error_message = ${error.message},
        updated_at = CURRENT_TIMESTAMP
      WHERE source = 'smithery_turbo';
    `;

    return Response.json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}

// Process a single page of servers
async function processSinglePage(page: number, includeUnverified: boolean) {
  const pageStart = Date.now();
  let synced = 0;
  const errors = [];
  const stats = [];

  try {
    // Fetch the page
    const response = await fetchSmitheryPage(page, 100);

    if (!response.success) {
      throw new Error(`Page ${page}: ${response.error}`);
    }

    const servers = response.data.servers || [];

    // Process servers in this page
    for (const server of servers) {
      try {
        // Skip unverified if requested
        if (!includeUnverified && !server.security?.scanPassed) {
          continue;
        }

        // Fetch detailed server info
        const details = await fetchServerDetails(server.qualifiedName);

        if (details) {
          // Transform and save
          const transformedData = transformServerData(details);
          await saveServerToDatabase(transformedData);

          synced++;

          // Collect stats
          stats.push({
            verified: details.security?.scanPassed || false,
            remote: details.remote || false,
            toolCount: details.tools?.length || 0,
            category: transformedData.category
          });
        }

      } catch (serverError) {
        console.error(`❌ Server ${server.qualifiedName}:`, serverError.message);
        errors.push({
          server: server.qualifiedName,
          error: serverError.message
        });
      }
    }

    const pageTime = Date.now() - pageStart;
    console.log(`✅ Page ${page}: ${synced}/${servers.length} servers (${pageTime}ms)`);

  } catch (pageError) {
    console.error(`❌ Page ${page} failed:`, pageError.message);
    errors.push({
      page: page,
      error: pageError.message
    });
  }

  return { synced, errors, stats };
}

// Fetch a page from Smithery
async function fetchSmitheryPage(page: number, pageSize: number) {
  try {
    const apiKey = process.env.SMITHERY_API_KEY;
    const baseUrl = 'https://registry.smithery.ai';

    const url = new URL(`${baseUrl}/servers`);
    url.searchParams.append('page', page.toString());
    url.searchParams.append('pageSize', pageSize.toString());

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return { success: true, data };

  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Fetch server details
async function fetchServerDetails(qualifiedName: string) {
  try {
    const apiKey = process.env.SMITHERY_API_KEY;
    const baseUrl = 'https://registry.smithery.ai';

    const response = await fetch(`${baseUrl}/servers/${encodeURIComponent(qualifiedName)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();

  } catch (error: any) {
    console.error(`Details error for ${qualifiedName}:`, error.message);
    return null;
  }
}

// Transform server data (simplified version)
function transformServerData(smitheryServer: any) {
  // Extract author and repo URL
  let author = null;
  let repoUrl = null;

  if (smitheryServer.qualifiedName) {
    const parts = smitheryServer.qualifiedName.split('/');
    if (parts.length > 0) {
      author = parts[0].replace('@', '');
    }
    if (parts.length >= 2) {
      const owner = parts[0].replace('@', '');
      const repo = parts[1];
      repoUrl = `https://github.com/${owner}/${repo}`;
    }
  }

  // Check for explicit repository URLs
  repoUrl = smitheryServer.repositoryUrl ||
            smitheryServer.repository ||
            smitheryServer.githubUrl ||
            smitheryServer.sourceCodeUrl ||
            smitheryServer.repoUrl ||
            repoUrl;

  // Infer category
  const category = inferCategory(smitheryServer);

  return {
    qualified_name: smitheryServer.qualifiedName,
    display_name: smitheryServer.displayName || smitheryServer.qualifiedName,
    description: smitheryServer.description,
    icon_url: smitheryServer.iconUrl,
    source: 'smithery',
    source_url: `https://smithery.ai/server/${smitheryServer.qualifiedName}`,
    homepage: smitheryServer.homepage || smitheryServer.deploymentUrl,
    is_remote: smitheryServer.remote || false,
    deployment_url: smitheryServer.deploymentUrl,
    connections: JSON.stringify(smitheryServer.connections || []),
    security_scan_passed: smitheryServer.security?.scanPassed || false,
    is_verified: smitheryServer.security?.scanPassed || false,
    tools: JSON.stringify(smitheryServer.tools || []),
    category: category,
    tags: generateTags(smitheryServer),
    use_count: smitheryServer.useCount || 0,
    author: author,
    repository_url: repoUrl,
    source_created_at: smitheryServer.createdAt || new Date().toISOString(),
    api_source: 'smithery'
  };
}

// Category inference
function inferCategory(server: any) {
  const description = (server.description || '').toLowerCase();
  const tools = server.tools || [];
  const toolNames = tools.map(t => t.name?.toLowerCase() || '').join(' ');
  const combined = `${description} ${toolNames}`;

  const categories = {
    'Finance': ['crypto', 'bitcoin', 'stock', 'trading', 'payment', 'coin'],
    'Data Collection': ['fetch', 'scrape', 'crawl', 'extract', 'collect', 'api'],
    'Search': ['search', 'query', 'find', 'lookup', 'google', 'web'],
    'Weather': ['weather', 'forecast', 'temperature', 'climate'],
    'AI/ML': ['ai', 'ml', 'machine learning', 'llm', 'model', 'neural'],
    'Database': ['database', 'sql', 'query', 'postgres', 'mysql', 'mongodb'],
    'Communication': ['email', 'sms', 'chat', 'message', 'notify'],
    'Development': ['code', 'debug', 'compile', 'build', 'deploy', 'git'],
    'File Management': ['file', 'folder', 'directory', 'storage'],
    'Security': ['auth', 'encrypt', 'security', 'password', 'token'],
    'Productivity': ['task', 'calendar', 'schedule', 'todo', 'note'],
    'Analytics': ['analytics', 'metrics', 'tracking', 'statistics']
  };

  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some(keyword => combined.includes(keyword))) {
      return category;
    }
  }

  return 'API Tools'; // Default category
}

// Generate tags
function generateTags(server: any) {
  const tags = new Set(['smithery']);

  if (server.remote) tags.add('remote');
  else tags.add('local');

  if (server.security?.scanPassed) tags.add('verified');

  const description = (server.description || '').toLowerCase();
  const commonTags = ['api', 'database', 'ai', 'ml', 'file', 'web', 'crypto', 'weather'];
  commonTags.forEach(tag => {
    if (description.includes(tag)) tags.add(tag);
  });

  return Array.from(tags);
}

// Save server to database
async function saveServerToDatabase(serverData: any) {
  const query = `
    INSERT INTO smithery_mcp_servers (
      qualified_name, display_name, description, icon_url,
      source, source_url, homepage, is_remote, deployment_url,
      connections, security_scan_passed, is_verified, tools,
      category, tags, use_count, author, repository_url,
      source_created_at, api_source
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
    )
    ON CONFLICT (qualified_name) DO UPDATE SET
      display_name = EXCLUDED.display_name,
      description = EXCLUDED.description,
      icon_url = EXCLUDED.icon_url,
      deployment_url = EXCLUDED.deployment_url,
      connections = EXCLUDED.connections,
      security_scan_passed = EXCLUDED.security_scan_passed,
      tools = EXCLUDED.tools,
      category = EXCLUDED.category,
      tags = EXCLUDED.tags,
      use_count = EXCLUDED.use_count,
      updated_at = CURRENT_TIMESTAMP
    RETURNING id;
  `;

  return sql.query(query, [
    serverData.qualified_name, serverData.display_name, serverData.description,
    serverData.icon_url, serverData.source, serverData.source_url,
    serverData.homepage, serverData.is_remote, serverData.deployment_url,
    serverData.connections, serverData.security_scan_passed, serverData.is_verified,
    serverData.tools, serverData.category, serverData.tags,
    serverData.use_count, serverData.author, serverData.repository_url,
    serverData.source_created_at, serverData.api_source
  ]);
}

// Update sync progress
async function updateSyncProgress(synced: number, total: number, currentPage: number, totalPages: number, recentErrors: any[]) {
  await sql`
    UPDATE sync_status SET
      total_servers = ${synced},
      last_page = ${currentPage},
      error_message = ${recentErrors.length > 0 ? JSON.stringify(recentErrors) : null},
      updated_at = CURRENT_TIMESTAMP
    WHERE source = 'smithery_turbo';
  `;
}

// GET endpoint for easy testing
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const batchSize = parseInt(searchParams.get('batchSize') || '10');
  const parallelRequests = parseInt(searchParams.get('parallelRequests') || '3');
  const includeUnverified = searchParams.get('includeUnverified') !== 'false';
  const startPage = parseInt(searchParams.get('startPage') || '1');

  return POST(new NextRequest(request.url, {
    method: 'POST',
    body: JSON.stringify({ batchSize, parallelRequests, includeUnverified, startPage }),
    headers: { 'Content-Type': 'application/json' }
  }));
}