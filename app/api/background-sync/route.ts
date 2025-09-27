import { NextRequest } from "next/server";
import { sql } from '@vercel/postgres';

// Background sync that runs continuously to reach 7,000 servers
let syncInProgress = false;

export async function POST(request: NextRequest) {
  try {
    if (syncInProgress) {
      return Response.json({
        success: false,
        error: "Sync already in progress",
        message: "Another sync operation is currently running"
      });
    }

    syncInProgress = true;

    // Start background sync (don't await - let it run)
    backgroundSyncProcess().finally(() => {
      syncInProgress = false;
    });

    return Response.json({
      success: true,
      message: "Background sync started",
      status: "running",
      target: "7,000 servers"
    });

  } catch (error: any) {
    syncInProgress = false;
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

async function backgroundSyncProcess() {
  try {
    console.log('🚀 Starting background sync to reach 7,000 servers...');

    const apiKey = process.env.SMITHERY_API_KEY;
    const baseUrl = 'https://registry.smithery.ai';

    // Get current count
    let currentResult = await sql`SELECT COUNT(*) FROM smithery_mcp_servers`;
    let currentCount = parseInt(currentResult.rows[0].count);

    console.log(`📊 Starting with ${currentCount} servers`);

    // Get first page to understand total available
    const firstPageResponse = await fetch(`${baseUrl}/servers?page=1&pageSize=100`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!firstPageResponse.ok) {
      throw new Error(`API error: ${firstPageResponse.status}`);
    }

    const firstPageData = await firstPageResponse.json();
    const totalAvailable = firstPageData.pagination?.totalCount || 0;
    console.log(`🎯 Target: ${Math.min(7000, totalAvailable)} servers available on Smithery`);

    let page = Math.ceil(currentCount / 100) + 1; // Start from where we left off
    let syncedThisRun = 0;
    let errorsThisRun = 0;

    // Sync in batches until we reach target
    while (currentCount < 7000 && page <= Math.ceil(totalAvailable / 100)) {
      try {
        console.log(`⚡ Syncing page ${page}...`);

        // Fetch page
        const pageResponse = await fetch(`${baseUrl}/servers?page=${page}&pageSize=100`, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        });

        if (!pageResponse.ok) {
          console.error(`❌ Page ${page} failed: HTTP ${pageResponse.status}`);
          errorsThisRun++;
          page++;
          continue;
        }

        const pageData = await pageResponse.json();
        const servers = pageData.servers || [];

        // Process each server on this page
        for (const server of servers) {
          try {
            // Check if we already have this server
            const existingCheck = await sql`
              SELECT id FROM smithery_mcp_servers
              WHERE qualified_name = ${server.qualifiedName}
            `;

            if (existingCheck.rows.length > 0) {
              continue; // Skip if we already have it
            }

            // Fetch detailed server info
            const detailResponse = await fetch(`${baseUrl}/servers/${encodeURIComponent(server.qualifiedName)}`, {
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
              }
            });

            if (!detailResponse.ok) {
              continue; // Skip this server if details fail
            }

            const details = await detailResponse.json();

            // Transform and save
            const transformedData = transformServerForDB(details);
            await saveServerToDB(transformedData);

            syncedThisRun++;
            currentCount++;

            // Log progress every 50 servers
            if (syncedThisRun % 50 === 0) {
              console.log(`✅ Progress: ${currentCount} total servers (+${syncedThisRun} this run)`);
            }

            // Break if we hit 7,000
            if (currentCount >= 7000) {
              console.log('🎉 TARGET REACHED: 7,000 servers!');
              break;
            }

            // Small delay to be nice to the API
            await new Promise(resolve => setTimeout(resolve, 50));

          } catch (serverError) {
            errorsThisRun++;
            console.error(`❌ Server ${server.qualifiedName}: ${serverError.message}`);
          }
        }

        if (currentCount >= 7000) break;

        page++;

        // Longer delay between pages
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (pageError) {
        console.error(`❌ Page ${page} error:`, pageError.message);
        errorsThisRun++;
        page++;

        // Wait longer on page errors
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`🎉 Background sync complete!`);
    console.log(`📊 Final count: ${currentCount} servers`);
    console.log(`✅ Synced this run: ${syncedThisRun} servers`);
    console.log(`❌ Errors this run: ${errorsThisRun}`);

    // Update sync status
    await sql`
      UPDATE sync_status SET
        status = ${currentCount >= 7000 ? 'completed' : 'partial'},
        total_servers = ${currentCount},
        error_message = ${errorsThisRun > 0 ? `${errorsThisRun} errors during sync` : null},
        updated_at = CURRENT_TIMESTAMP
      WHERE source = 'smithery';
    `;

  } catch (error) {
    console.error('💥 Background sync failed:', error);
  }
}

function transformServerForDB(server: any) {
  // Extract author and repo URL
  let author = null;
  let repoUrl = null;

  if (server.qualifiedName) {
    const parts = server.qualifiedName.split('/');
    if (parts.length > 0) {
      author = parts[0].replace('@', '');
    }
    if (parts.length >= 2) {
      const owner = parts[0].replace('@', '');
      const repo = parts[1];
      repoUrl = `https://github.com/${owner}/${repo}`;
    }
  }

  repoUrl = server.repositoryUrl || server.repository || server.githubUrl || repoUrl;

  // Infer category
  const description = (server.description || '').toLowerCase();
  const tools = server.tools || [];
  const toolNames = tools.map(t => t.name?.toLowerCase() || '').join(' ');
  const combined = `${description} ${toolNames}`;

  let category = 'API Tools'; // default

  const categories = {
    'Finance': ['crypto', 'bitcoin', 'stock', 'trading', 'payment'],
    'Data Collection': ['fetch', 'scrape', 'crawl', 'extract', 'collect'],
    'Search': ['search', 'query', 'find', 'lookup', 'google', 'web'],
    'Weather': ['weather', 'forecast', 'temperature', 'climate'],
    'AI/ML': ['ai', 'ml', 'machine learning', 'llm', 'model'],
    'Database': ['database', 'sql', 'query', 'postgres', 'mysql'],
    'Communication': ['email', 'sms', 'chat', 'message', 'notify'],
    'Development': ['code', 'debug', 'compile', 'build', 'deploy', 'git', 'unity', 'game'],
    'File Management': ['file', 'folder', 'directory', 'storage'],
    'Security': ['auth', 'encrypt', 'security', 'password', 'token']
  };

  for (const [cat, keywords] of Object.entries(categories)) {
    if (keywords.some(keyword => combined.includes(keyword))) {
      category = cat;
      break;
    }
  }

  return {
    qualified_name: server.qualifiedName,
    display_name: server.displayName || server.qualifiedName,
    description: server.description,
    icon_url: server.iconUrl,
    source: 'smithery',
    source_url: `https://smithery.ai/server/${server.qualifiedName}`,
    homepage: server.homepage || server.deploymentUrl,
    is_remote: server.remote || false,
    deployment_url: server.deploymentUrl,
    connections: JSON.stringify(server.connections || []),
    security_scan_passed: server.security?.scanPassed || false,
    is_verified: server.security?.scanPassed || false,
    tools: JSON.stringify(server.tools || []),
    category: category,
    tags: ['smithery', server.remote ? 'remote' : 'local', ...(server.security?.scanPassed ? ['verified'] : [])],
    use_count: server.useCount || 0,
    author: author,
    repository_url: repoUrl,
    source_created_at: server.createdAt || new Date().toISOString(),
    api_source: 'smithery'
  };
}

async function saveServerToDB(serverData: any) {
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

// GET endpoint to check sync status
export async function GET() {
  try {
    const countResult = await sql`SELECT COUNT(*) FROM smithery_mcp_servers`;
    const currentCount = parseInt(countResult.rows[0].count);

    const statusResult = await sql`
      SELECT * FROM sync_status WHERE source = 'smithery' ORDER BY updated_at DESC LIMIT 1
    `;

    return Response.json({
      success: true,
      currentCount,
      target: 7000,
      progress: `${((currentCount / 7000) * 100).toFixed(1)}%`,
      remaining: Math.max(0, 7000 - currentCount),
      syncInProgress,
      lastSync: statusResult.rows[0] || null
    });

  } catch (error: any) {
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}