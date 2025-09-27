import { NextRequest } from "next/server";
import { sql } from '@vercel/postgres';

// Scheduled sync - pulls exactly 50 servers per run
// Perfect for cron jobs to avoid API rate limits
export async function POST(request: NextRequest) {
  try {
    console.log('⏰ Starting scheduled sync (50 servers)...');

    const startTime = Date.now();
    const targetServers = 50;

    // Check if another sync is running
    const syncCheck = await sql`
      SELECT * FROM sync_status
      WHERE source = 'smithery_scheduled'
      AND status = 'syncing'
    `;

    if (syncCheck.rows.length > 0) {
      return Response.json({
        success: false,
        error: "Scheduled sync already in progress",
        message: "Another scheduled sync is currently running"
      });
    }

    // Initialize/update sync status
    await sql`
      INSERT INTO sync_status (source, status, last_sync_at, total_servers, error_message)
      VALUES ('smithery_scheduled', 'syncing', CURRENT_TIMESTAMP, 0, null)
      ON CONFLICT (source) DO UPDATE SET
        status = 'syncing',
        last_sync_at = CURRENT_TIMESTAMP,
        error_message = null,
        updated_at = CURRENT_TIMESTAMP;
    `;

    // Get current count and determine next page to fetch
    const countResult = await sql`SELECT COUNT(*) FROM smithery_mcp_servers`;
    const currentCount = parseInt(countResult.rows[0].count);

    // Calculate starting page (50 servers per page, start from next unfetched page)
    const serversPerPage = 50;
    const startPage = Math.floor(currentCount / serversPerPage) + 1;

    console.log(`📊 Current servers: ${currentCount}, starting from page ${startPage}`);

    const apiKey = process.env.SMITHERY_API_KEY;
    const baseUrl = 'https://registry.smithery.ai';

    let syncedCount = 0;
    let errorCount = 0;
    const errors = [];
    let currentPage = startPage;

    // Fetch exactly 50 servers (1 page of 50)
    try {
      console.log(`⚡ Fetching page ${currentPage} (${serversPerPage} servers)...`);

      const pageResponse = await fetch(`${baseUrl}/servers?page=${currentPage}&pageSize=${serversPerPage}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!pageResponse.ok) {
        throw new Error(`API error: ${pageResponse.status} ${pageResponse.statusText}`);
      }

      const pageData = await pageResponse.json();
      const servers = pageData.servers || [];
      const totalAvailable = pageData.pagination?.totalCount || 0;

      console.log(`📦 Received ${servers.length} servers, ${totalAvailable} total available`);

      // Process each server
      for (const server of servers) {
        try {
          // Check if server already exists
          const existingCheck = await sql`
            SELECT id FROM smithery_mcp_servers
            WHERE qualified_name = ${server.qualifiedName}
          `;

          if (existingCheck.rows.length > 0) {
            console.log(`⏭️  Skipping existing server: ${server.qualifiedName}`);
            continue;
          }

          // Fetch detailed server info
          const detailResponse = await fetch(`${baseUrl}/servers/${encodeURIComponent(server.qualifiedName)}`, {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            }
          });

          if (!detailResponse.ok) {
            console.log(`⚠️  Details failed for ${server.qualifiedName}: ${detailResponse.status}`);
            continue;
          }

          const details = await detailResponse.json();

          // Transform and save
          const transformedData = transformServerForScheduledSync(details);
          await saveServerToDatabase(transformedData);

          syncedCount++;
          console.log(`✅ Added server ${syncedCount}: ${server.qualifiedName}`);

          // Small delay to be API-friendly
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (serverError: any) {
          errorCount++;
          errors.push({
            server: server.qualifiedName,
            error: serverError.message
          });
          console.error(`❌ Server error ${server.qualifiedName}:`, serverError.message);
        }
      }

      // Check if we've reached the end
      const isComplete = servers.length < serversPerPage || currentCount + syncedCount >= totalAvailable;

      const totalTime = Date.now() - startTime;
      const finalCount = currentCount + syncedCount;

      // Update sync status
      await sql`
        UPDATE sync_status SET
          status = ${isComplete ? 'completed' : 'partial'},
          total_servers = ${finalCount},
          last_page = ${currentPage},
          error_message = ${errors.length > 0 ? JSON.stringify(errors.slice(-5)) : null},
          updated_at = CURRENT_TIMESTAMP
        WHERE source = 'smithery_scheduled';
      `;

      console.log(`🎉 Scheduled sync complete!`);
      console.log(`📊 Added ${syncedCount} new servers (${errorCount} errors)`);
      console.log(`⏱️  Total time: ${totalTime}ms`);
      console.log(`📈 Database now has ${finalCount} servers`);

      return Response.json({
        success: true,
        summary: {
          serversAdded: syncedCount,
          errors: errorCount,
          totalServers: finalCount,
          pageProcessed: currentPage,
          isComplete: isComplete,
          timeMs: totalTime
        },
        nextSchedule: {
          recommended: isComplete ? "No more servers available" : "Run again in 2-6 hours",
          nextPage: currentPage + 1
        },
        errors: errors.slice(-3) // Last 3 errors only
      });

    } catch (pageError: any) {
      console.error(`❌ Page ${currentPage} failed:`, pageError.message);

      // Update status to failed
      await sql`
        UPDATE sync_status SET
          status = 'failed',
          error_message = ${pageError.message},
          updated_at = CURRENT_TIMESTAMP
        WHERE source = 'smithery_scheduled';
      `;

      return Response.json({
        success: false,
        error: `Page ${currentPage} failed: ${pageError.message}`,
        serversAdded: syncedCount,
        currentCount: currentCount + syncedCount
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('💥 Scheduled sync failed:', error);

    // Update status to failed
    await sql`
      UPDATE sync_status SET
        status = 'failed',
        error_message = ${error.message},
        updated_at = CURRENT_TIMESTAMP
      WHERE source = 'smithery_scheduled';
    `;

    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

// Transform server data for database insertion
function transformServerForScheduledSync(server: any) {
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
    'Development': ['code', 'debug', 'compile', 'build', 'deploy', 'git'],
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

// GET endpoint for easy testing
export async function GET() {
  return POST(new NextRequest('http://localhost/scheduled-sync', { method: 'POST' }));
}