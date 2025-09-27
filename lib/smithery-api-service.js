// Smithery API Service - Fetches MCP servers from Smithery registry
const { sql } = require('@vercel/postgres');

class SmitheryAPIService {
  constructor(apiKey) {
    this.apiKey = apiKey || process.env.SMITHERY_API_KEY;
    this.baseUrl = 'https://registry.smithery.ai';
  }

  // Fetch a page of servers from Smithery
  async fetchServers(page = 1, pageSize = 100, query = '') {
    try {
      const url = new URL(`${this.baseUrl}/servers`);
      url.searchParams.append('page', page.toString());
      url.searchParams.append('pageSize', pageSize.toString());
      if (query) {
        url.searchParams.append('q', query);
      }

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Smithery API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching servers from Smithery:', error);
      throw error;
    }
  }

  // Fetch detailed information about a specific server
  async fetchServerDetails(qualifiedName) {
    try {
      const response = await fetch(`${this.baseUrl}/servers/${encodeURIComponent(qualifiedName)}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          console.warn(`Server not found: ${qualifiedName}`);
          return null;
        }
        throw new Error(`Smithery API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Error fetching server details for ${qualifiedName}:`, error);
      throw error;
    }
  }

  // Transform Smithery server data to our database format
  transformServerData(smitheryServer, source = 'smithery') {
    // Extract owner and repo from qualified name if possible
    let author = null;
    let repoUrl = null;

    if (smitheryServer.qualifiedName) {
      const parts = smitheryServer.qualifiedName.split('/');
      if (parts.length > 0) {
        author = parts[0].replace('@', '');
      }
      // Try to construct GitHub URL from qualified name if no explicit repo URL
      if (parts.length >= 2) {
        const owner = parts[0].replace('@', '');
        const repo = parts[1];
        repoUrl = `https://github.com/${owner}/${repo}`;
      }
    }

    // Check for explicit repository URLs in various possible field names
    repoUrl = smitheryServer.repositoryUrl ||
              smitheryServer.repository ||
              smitheryServer.githubUrl ||
              smitheryServer.sourceCodeUrl ||
              smitheryServer.repoUrl ||
              repoUrl;

    // Extract categories from description or tools
    const category = this.inferCategory(smitheryServer);

    // Generate tags for searching
    const tags = this.generateTags(smitheryServer);

    return {
      qualified_name: smitheryServer.qualifiedName,
      display_name: smitheryServer.displayName || smitheryServer.qualifiedName,
      description: smitheryServer.description,
      icon_url: smitheryServer.iconUrl,
      source: source,
      source_url: `https://smithery.ai/server/${smitheryServer.qualifiedName}`,
      homepage: smitheryServer.homepage || smitheryServer.deploymentUrl,
      is_remote: smitheryServer.remote || false,
      deployment_url: smitheryServer.deploymentUrl,
      connections: JSON.stringify(smitheryServer.connections || []),
      security_scan_passed: smitheryServer.security?.scanPassed || false,
      is_verified: smitheryServer.security?.scanPassed || false,
      tools: JSON.stringify(smitheryServer.tools || []),
      category: category,
      tags: tags,
      use_count: smitheryServer.useCount || 0,
      author: author,
      repository_url: repoUrl,
      source_created_at: smitheryServer.createdAt || new Date().toISOString()
    };
  }

  // Infer category based on tools and description
  inferCategory(server) {
    const description = (server.description || '').toLowerCase();
    const tools = server.tools || [];
    const toolNames = tools.map(t => t.name.toLowerCase()).join(' ');
    const combined = `${description} ${toolNames}`;

    const categories = {
      'Data Collection': ['fetch', 'scrape', 'crawl', 'extract', 'collect'],
      'Database': ['database', 'sql', 'query', 'postgres', 'mysql', 'mongodb'],
      'AI/ML': ['ai', 'ml', 'machine learning', 'llm', 'model', 'neural'],
      'Development': ['code', 'debug', 'compile', 'build', 'deploy'],
      'Communication': ['email', 'sms', 'chat', 'message', 'notify'],
      'Finance': ['payment', 'crypto', 'bitcoin', 'stock', 'trading', 'coin'],
      'Weather': ['weather', 'forecast', 'temperature', 'climate'],
      'File Management': ['file', 'folder', 'directory', 'storage'],
      'API Tools': ['api', 'rest', 'graphql', 'webhook'],
      'Security': ['auth', 'encrypt', 'security', 'password', 'token'],
      'Productivity': ['task', 'calendar', 'schedule', 'todo', 'note'],
      'Analytics': ['analytics', 'metrics', 'tracking', 'statistics']
    };

    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => combined.includes(keyword))) {
        return category;
      }
    }

    return 'Uncategorized';
  }

  // Generate searchable tags
  generateTags(server) {
    const tags = new Set();

    // Add source as tag
    tags.add('smithery');

    // Add remote/local tag
    if (server.remote) {
      tags.add('remote');
    } else {
      tags.add('local');
    }

    // Add verified tag
    if (server.security?.scanPassed) {
      tags.add('verified');
    }

    // Extract tags from description
    const description = (server.description || '').toLowerCase();
    const commonTags = ['api', 'database', 'ai', 'ml', 'file', 'web', 'crypto', 'weather', 'automation'];
    commonTags.forEach(tag => {
      if (description.includes(tag)) {
        tags.add(tag);
      }
    });

    // Add tool names as tags
    if (server.tools && Array.isArray(server.tools)) {
      server.tools.forEach(tool => {
        const toolName = tool.name.toLowerCase().replace(/_/g, '-');
        tags.add(toolName);
      });
    }

    return Array.from(tags);
  }

  // Save server to database
  async saveServerToDatabase(serverData) {
    try {
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

      const result = await sql.query(query, [
        serverData.qualified_name,
        serverData.display_name,
        serverData.description,
        serverData.icon_url,
        serverData.source,
        serverData.source_url,
        serverData.homepage,
        serverData.is_remote,
        serverData.deployment_url,
        serverData.connections,
        serverData.security_scan_passed,
        serverData.is_verified,
        serverData.tools,
        serverData.category,
        serverData.tags,
        serverData.use_count,
        serverData.author,
        serverData.repository_url,
        serverData.source_created_at,
        'smithery'
      ]);

      return result.rows[0];
    } catch (error) {
      console.error('Error saving server to database:', error);
      throw error;
    }
  }

  // Main sync function to fetch all servers from Smithery
  async syncAllServers(onProgress = null) {
    let page = 1;
    let totalPages = 1;
    let totalSynced = 0;
    let errors = [];

    try {
      // Update sync status to 'syncing'
      await sql`
        INSERT INTO sync_status (source, status, last_sync_at)
        VALUES ('smithery', 'syncing', CURRENT_TIMESTAMP)
        ON CONFLICT (source) DO UPDATE SET
          status = 'syncing',
          last_sync_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP;
      `;

      while (page <= totalPages) {
        try {
          console.log(`Fetching page ${page}...`);
          const response = await this.fetchServers(page, 100);

          if (response.pagination) {
            totalPages = response.pagination.totalPages;
          }

          // Process each server
          for (const server of response.servers) {
            try {
              // Fetch detailed info for each server
              const details = await this.fetchServerDetails(server.qualifiedName);

              if (details) {
                const transformedData = this.transformServerData(details);
                await this.saveServerToDatabase(transformedData);
                totalSynced++;

                if (onProgress) {
                  onProgress({
                    current: totalSynced,
                    total: response.pagination?.totalCount,
                    page: page,
                    totalPages: totalPages
                  });
                }
              }

              // Add small delay to avoid rate limiting
              await new Promise(resolve => setTimeout(resolve, 100));
            } catch (serverError) {
              console.error(`Error processing server ${server.qualifiedName}:`, serverError);
              errors.push({
                server: server.qualifiedName,
                error: serverError.message
              });
            }
          }

          page++;
        } catch (pageError) {
          console.error(`Error fetching page ${page}:`, pageError);
          errors.push({
            page: page,
            error: pageError.message
          });
          break;
        }
      }

      // Update sync status to 'completed'
      await sql`
        UPDATE sync_status SET
          status = 'completed',
          last_page = ${page - 1},
          total_servers = ${totalSynced},
          error_message = ${errors.length > 0 ? JSON.stringify(errors) : null},
          updated_at = CURRENT_TIMESTAMP
        WHERE source = 'smithery';
      `;

      return {
        success: true,
        totalSynced: totalSynced,
        errors: errors
      };

    } catch (error) {
      console.error('Sync failed:', error);

      // Update sync status to 'failed'
      await sql`
        UPDATE sync_status SET
          status = 'failed',
          error_message = ${error.message},
          updated_at = CURRENT_TIMESTAMP
        WHERE source = 'smithery';
      `;

      throw error;
    }
  }
}

module.exports = SmitheryAPIService;