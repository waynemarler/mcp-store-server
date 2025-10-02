import { sql } from '@vercel/postgres';
import type { MCPServerMetadata, MCPServerRegistration, DiscoveryQuery, HealthStatus, ServerMetric, Author, PartialAuthor, Category } from '@/lib/types';

export class EnhancedPostgresRegistryStore {
  constructor() {
    this.initializeTables();
  }

  private async initializeTables() {
    try {
      const migrationScript = `
        -- Create tables only if they don't exist
        CREATE TABLE IF NOT EXISTS authors (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          website TEXT,
          contact_email TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS mcp_servers (
          id VARCHAR(255) PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          logo_url TEXT,
          endpoint TEXT NOT NULL,
          api_key VARCHAR(255),
          type TEXT CHECK (type IN ('informational', 'transactional', 'task')),
          version TEXT,
          author_id INT REFERENCES authors(id),
          verified BOOLEAN DEFAULT FALSE,
          trust_score INT DEFAULT 50 CHECK (trust_score >= 0 AND trust_score <= 100),
          status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'deprecated')),
          last_health_check TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS categories (
          id SERIAL PRIMARY KEY,
          main_category TEXT NOT NULL,
          sub_category TEXT NOT NULL,
          description TEXT,
          UNIQUE(main_category, sub_category)
        );

        CREATE TABLE IF NOT EXISTS server_categories (
          server_id VARCHAR(255) REFERENCES mcp_servers(id) ON DELETE CASCADE,
          category_id INT REFERENCES categories(id) ON DELETE CASCADE,
          PRIMARY KEY (server_id, category_id)
        );

        CREATE TABLE IF NOT EXISTS tags (
          id SERIAL PRIMARY KEY,
          tag_name TEXT UNIQUE NOT NULL
        );

        CREATE TABLE IF NOT EXISTS server_tags (
          server_id VARCHAR(255) REFERENCES mcp_servers(id) ON DELETE CASCADE,
          tag_id INT REFERENCES tags(id) ON DELETE CASCADE,
          PRIMARY KEY (server_id, tag_id)
        );

        CREATE TABLE IF NOT EXISTS capabilities (
          id SERIAL PRIMARY KEY,
          capability_name TEXT UNIQUE NOT NULL,
          description TEXT
        );

        CREATE TABLE IF NOT EXISTS server_capabilities (
          server_id VARCHAR(255) REFERENCES mcp_servers(id) ON DELETE CASCADE,
          capability_id INT REFERENCES capabilities(id) ON DELETE CASCADE,
          PRIMARY KEY (server_id, capability_id)
        );

        CREATE TABLE IF NOT EXISTS server_metrics (
          id SERIAL PRIMARY KEY,
          server_id VARCHAR(255) REFERENCES mcp_servers(id) ON DELETE CASCADE,
          metric_type TEXT NOT NULL CHECK (metric_type IN ('request', 'error', 'latency')),
          value NUMERIC,
          metadata JSONB,
          recorded_at TIMESTAMP DEFAULT NOW()
        );
      `;

      // Execute each statement separately
      const statements = migrationScript.split(';').filter(s => s.trim());
      for (const statement of statements) {
        if (statement.trim()) {
          await sql.query(statement);
        }
      }

      // Create indexes
      await sql`CREATE INDEX IF NOT EXISTS idx_mcp_servers_author ON mcp_servers(author_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_mcp_servers_verified ON mcp_servers(verified)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_mcp_servers_status ON mcp_servers(status)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_mcp_servers_trust_score ON mcp_servers(trust_score DESC)`;

      console.log('Enhanced Postgres tables initialized successfully');
    } catch (error: any) {
      console.error('Error initializing enhanced Postgres tables:', error.message);
    }
  }

  async register(server: any): Promise<void> {
    try {
      console.log('Registering server in enhanced Postgres:', server.id);

      // Start transaction
      await sql`BEGIN`;

      // Insert or update author if provided
      let authorId = server.authorId;
      if (server.author && !authorId) {
        // Check if it's a full Author or PartialAuthor
        const isFullAuthor = 'id' in server.author;
        if (isFullAuthor) {
          authorId = (server.author as Author).id;
        } else {
          // Handle PartialAuthor - insert or find existing
          const authorResult = await sql`
            INSERT INTO authors (name, website, contact_email)
            VALUES (${server.author.name}, ${server.author.website || null}, ${server.author.contactEmail || null})
            ON CONFLICT DO NOTHING
            RETURNING id
          `;

          if (authorResult.rows.length > 0) {
            authorId = authorResult.rows[0].id;
          } else {
            // Author already exists, get their ID
            const existingAuthor = await sql`
              SELECT id FROM authors WHERE name = ${server.author.name}
            `;
            authorId = existingAuthor.rows[0]?.id;
          }
        }
      }

      // Insert or update server
      await sql`
        INSERT INTO mcp_servers (
          id, name, description, logo_url, endpoint, api_key, type, version,
          author_id, verified, trust_score, status, created_at, updated_at
        ) VALUES (
          ${server.id}, ${server.name}, ${server.description || null},
          ${server.logoUrl || null}, ${server.endpoint}, ${server.apiKey || null},
          ${server.type || null}, ${server.version || null}, ${authorId || null},
          ${server.verified}, ${server.trustScore}, ${server.status || 'active'},
          ${server.createdAt.toISOString()}, ${server.updatedAt.toISOString()}
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          logo_url = EXCLUDED.logo_url,
          endpoint = EXCLUDED.endpoint,
          api_key = EXCLUDED.api_key,
          type = EXCLUDED.type,
          version = EXCLUDED.version,
          author_id = EXCLUDED.author_id,
          verified = EXCLUDED.verified,
          trust_score = EXCLUDED.trust_score,
          status = EXCLUDED.status,
          updated_at = EXCLUDED.updated_at
      `;

      // Clear existing relationships
      await sql`DELETE FROM server_categories WHERE server_id = ${server.id}`;
      await sql`DELETE FROM server_capabilities WHERE server_id = ${server.id}`;
      await sql`DELETE FROM server_tags WHERE server_id = ${server.id}`;

      // Insert categories
      if (server.categories && server.categories.length > 0) {
        for (const category of server.categories) {
          // Insert category if it doesn't exist
          const categoryResult = await sql`
            INSERT INTO categories (main_category, sub_category, description)
            VALUES (${category.mainCategory}, ${category.subCategory}, ${category.description || null})
            ON CONFLICT (main_category, sub_category) DO UPDATE SET
              description = EXCLUDED.description
            RETURNING id
          `;

          const categoryId = categoryResult.rows[0].id;

          // Link server to category
          await sql`
            INSERT INTO server_categories (server_id, category_id)
            VALUES (${server.id}, ${categoryId})
            ON CONFLICT DO NOTHING
          `;
        }
      }

      // Insert capabilities
      for (const capability of server.capabilities) {
        // Insert capability if it doesn't exist
        await sql`
          INSERT INTO capabilities (capability_name)
          VALUES (${capability})
          ON CONFLICT (capability_name) DO NOTHING
        `;

        // Get capability ID
        const capResult = await sql`
          SELECT id FROM capabilities WHERE capability_name = ${capability}
        `;

        if (capResult.rows.length > 0) {
          // Link server to capability
          await sql`
            INSERT INTO server_capabilities (server_id, capability_id)
            VALUES (${server.id}, ${capResult.rows[0].id})
            ON CONFLICT DO NOTHING
          `;
        }
      }

      // Insert tags
      if (server.tags && server.tags.length > 0) {
        for (const tag of server.tags) {
          // Insert tag if it doesn't exist
          await sql`
            INSERT INTO tags (tag_name)
            VALUES (${tag})
            ON CONFLICT (tag_name) DO NOTHING
          `;

          // Get tag ID
          const tagResult = await sql`
            SELECT id FROM tags WHERE tag_name = ${tag}
          `;

          if (tagResult.rows.length > 0) {
            // Link server to tag
            await sql`
              INSERT INTO server_tags (server_id, tag_id)
              VALUES (${server.id}, ${tagResult.rows[0].id})
              ON CONFLICT DO NOTHING
            `;
          }
        }
      }

      await sql`COMMIT`;
      console.log('Server registered successfully in enhanced Postgres');
    } catch (error: any) {
      await sql`ROLLBACK`;
      console.error('Enhanced Postgres registration error:', {
        error: error.message,
        serverId: server.id,
        operation: 'register'
      });
      throw error;
    }
  }

  async get(serverId: string): Promise<MCPServerMetadata | null> {
    try {
      // Get server with author
      const serverResult = await sql`
        SELECT
          s.*,
          a.name as author_name,
          a.website as author_website,
          a.contact_email as author_email,
          a.created_at as author_created_at
        FROM mcp_servers s
        LEFT JOIN authors a ON s.author_id = a.id
        WHERE s.id = ${serverId}
      `;

      if (serverResult.rows.length === 0) {
        return null;
      }

      const row = serverResult.rows[0];

      // Get categories
      const categoriesResult = await sql`
        SELECT c.* FROM categories c
        JOIN server_categories sc ON c.id = sc.category_id
        WHERE sc.server_id = ${serverId}
      `;

      // Get capabilities
      const capabilitiesResult = await sql`
        SELECT cap.capability_name FROM capabilities cap
        JOIN server_capabilities sc ON cap.id = sc.capability_id
        WHERE sc.server_id = ${serverId}
      `;

      // Get tags
      const tagsResult = await sql`
        SELECT t.tag_name FROM tags t
        JOIN server_tags st ON t.id = st.tag_id
        WHERE st.server_id = ${serverId}
      `;

      const categories = categoriesResult.rows.map(c => ({
        id: c.id,
        mainCategory: c.main_category,
        subCategory: c.sub_category,
        description: c.description
      }));

      return {
        id: row.id,
        name: row.name,
        description: row.description,
        category: categories[0] ? `${categories[0].mainCategory}/${categories[0].subCategory}` : 'Uncategorized',
        logoUrl: row.logo_url,
        endpoint: row.endpoint,
        apiKey: row.api_key,
        type: row.type,
        version: row.version,
        author: row.author_id ? {
          id: row.author_id,
          name: row.author_name,
          website: row.author_website,
          contactEmail: row.author_email,
          createdAt: new Date(row.author_created_at)
        } as Author : undefined,
        categories,
        capabilities: capabilitiesResult.rows.map(c => c.capability_name),
        tags: tagsResult.rows.map(t => t.tag_name),
        verified: row.verified,
        trustScore: row.trust_score,
        status: row.status,
        lastHealthCheck: row.last_health_check ? new Date(row.last_health_check) : undefined,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      };
    } catch (error: any) {
      console.error('Error getting server from enhanced Postgres:', error.message);
      return null;
    }
  }

  async discover(query: DiscoveryQuery): Promise<MCPServerMetadata[]> {
    try {
      console.log('Enhanced Postgres discovery query:', query);

      // Get both internal enhanced servers and external Smithery servers
      const [internalResult, externalResult] = await Promise.allSettled([
        this.getInternalServers(query),
        this.getExternalServers(query)
      ]);

      const servers: MCPServerMetadata[] = [];

      // Add internal servers
      if (internalResult.status === 'fulfilled') {
        servers.push(...internalResult.value);
      }

      // Add external servers
      if (externalResult.status === 'fulfilled') {
        servers.push(...externalResult.value);
      }

      console.log(`Enhanced store found ${servers.length} servers total (internal + external)`);
      return servers.sort((a, b) => b.trustScore - a.trustScore);
    } catch (error: any) {
      console.error('Enhanced Postgres discovery error:', error.message);
      return [];
    }
  }

  private async getInternalServers(query: DiscoveryQuery): Promise<MCPServerMetadata[]> {
    try {
      let whereConditions: string[] = ['1=1'];
      const params: any[] = [];

      if (query.capability) {
        whereConditions.push(`
          EXISTS (
            SELECT 1 FROM server_capabilities sc
            JOIN capabilities c ON sc.capability_id = c.id
            WHERE sc.server_id = s.id AND c.capability_name = $${params.length + 1}
          )
        `);
        params.push(query.capability);
      }

      if (query.category) {
        whereConditions.push(`
          EXISTS (
            SELECT 1 FROM server_categories sc
            JOIN categories c ON sc.category_id = c.id
            WHERE sc.server_id = s.id AND (
              c.main_category = $${params.length + 1} OR
              c.sub_category = $${params.length + 1}
            )
          )
        `);
        params.push(query.category);
      }

      if (query.verified !== undefined) {
        whereConditions.push(`s.verified = $${params.length + 1}`);
        params.push(query.verified);
      }

      const queryText = `
        SELECT DISTINCT
          s.*,
          a.name as author_name,
          a.website as author_website,
          a.contact_email as author_email,
          a.created_at as author_created_at
        FROM mcp_servers s
        LEFT JOIN authors a ON s.author_id = a.id
        WHERE ${whereConditions.join(' AND ')}
        AND s.status = 'active'
        ORDER BY s.trust_score DESC, s.created_at DESC
      `;

      const result = await sql.query(queryText, params);

      const servers: MCPServerMetadata[] = [];
      for (const row of result.rows) {
        // Get categories for each server
        const categoriesResult = await sql`
          SELECT c.* FROM categories c
          JOIN server_categories sc ON c.id = sc.category_id
          WHERE sc.server_id = ${row.id}
        `;

        // Get capabilities
        const capabilitiesResult = await sql`
          SELECT cap.capability_name FROM capabilities cap
          JOIN server_capabilities sc ON cap.id = sc.capability_id
          WHERE sc.server_id = ${row.id}
        `;

        // Get tags
        const tagsResult = await sql`
          SELECT t.tag_name FROM tags t
          JOIN server_tags st ON t.id = st.tag_id
          WHERE st.server_id = ${row.id}
        `;

        const categories = categoriesResult.rows.map(c => ({
          id: c.id,
          mainCategory: c.main_category,
          subCategory: c.sub_category,
          description: c.description
        }));

        servers.push({
          id: row.id,
          name: row.name,
          description: row.description,
          category: categories[0] ? `${categories[0].mainCategory}/${categories[0].subCategory}` : 'Uncategorized',
          logoUrl: row.logo_url,
          endpoint: row.endpoint,
          apiKey: row.api_key,
          type: row.type,
          version: row.version,
          author: row.author_id ? {
            id: row.author_id,
            name: row.author_name,
            website: row.author_website,
            contactEmail: row.author_email,
            createdAt: new Date(row.author_created_at)
          } as Author : undefined,
          categories,
          capabilities: capabilitiesResult.rows.map(c => c.capability_name),
          tags: tagsResult.rows.map(t => t.tag_name),
          verified: row.verified,
          trustScore: row.trust_score,
          status: row.status,
          lastHealthCheck: row.last_health_check ? new Date(row.last_health_check) : undefined,
          createdAt: new Date(row.created_at),
          updatedAt: new Date(row.updated_at)
        });
      }

      console.log(`Found ${servers.length} internal servers in enhanced Postgres`);
      return servers;
    } catch (error: any) {
      console.error('Enhanced Postgres internal servers error:', error.message);
      return [];
    }
  }

  private async getExternalServers(query: DiscoveryQuery): Promise<MCPServerMetadata[]> {
    try {
      // Just get all servers like the regular store does, we'll filter in application code
      const result = await sql`
        SELECT
          'ext_' || id as id, display_name as name, description,
          category,
          CASE
            WHEN tools IS NOT NULL AND jsonb_array_length(tools) > 0 THEN
              (SELECT jsonb_agg(tool->>'name') FROM jsonb_array_elements(tools) AS tool)
            ELSE '[]'::jsonb
          END as capabilities,
          deployment_url as endpoint, null as api_key,
          is_verified as verified,
          CASE WHEN use_count > 100 THEN 85 ELSE 70 END as trust_score,
          source_created_at as last_health_check,
          source_created_at as created_at, updated_at,
          'external' as source, icon_url, qualified_name,
          use_count, author, homepage, repository_url, source_url,
          tools, tags, is_remote, security_scan_passed,
          deployment_url, connections, downloads, version,
          source_created_at, fetched_at, api_source, raw_json
        FROM smithery_mcp_servers
        ORDER BY use_count DESC, source_created_at DESC
      `;

      console.log(`Enhanced store external query returned ${result.rows.length} servers from smithery_mcp_servers`);

      // 🐛 DEBUG: Check if LibraLM (ext_1588) is in SQL results (after 'ext_' transformation)
      const libraLMRow = result.rows.find(row => row.id === 'ext_1588');
      console.log(`🔍 DEBUG: LibraLM (ext_1588) in SQL results:`, libraLMRow ? 'YES' : 'NO');
      if (libraLMRow) {
        console.log(`🔍 DEBUG: LibraLM SQL data:`, JSON.stringify(libraLMRow, null, 2));
      }

      let servers = result.rows.map(row => ({
        id: row.id,
        name: row.name,
        display_name: row.name,
        qualified_name: row.qualified_name,
        description: row.description,
        category: row.category,
        capabilities: row.capabilities,
        endpoint: row.endpoint || 'https://smithery.ai',
        apiKey: row.api_key,
        verified: row.verified,
        trustScore: row.trust_score,
        status: 'active' as const,
        lastHealthCheck: row.last_health_check ? new Date(row.last_health_check) : undefined,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
        // Additional Smithery fields
        icon_url: row.icon_url,
        use_count: row.use_count,
        author: row.author,
        homepage: row.homepage,
        repository_url: row.repository_url,
        source_url: row.source_url,
        tools: row.tools,
        tags: row.tags,
        is_remote: row.is_remote,
        security_scan_passed: row.security_scan_passed,
        deployment_url: row.deployment_url,
        connections: row.connections,
        downloads: row.downloads,
        version: row.version,
        source_created_at: row.source_created_at,
        fetched_at: row.fetched_at,
        api_source: row.api_source,
        raw_json: row.raw_json
      }));

      // 🐛 DEBUG: Check if LibraLM survived the mapping
      const libraLMServer = servers.find(server => server.id === 'ext_1588');
      console.log(`🔍 DEBUG: LibraLM (ext_1588) after mapping:`, libraLMServer ? 'YES' : 'NO');
      if (libraLMServer) {
        console.log(`🔍 DEBUG: LibraLM mapped data:`, JSON.stringify(libraLMServer, null, 2));
      }

      // Apply filtering at application level
      if (query.category) {
        servers = servers.filter(server => server.category === query.category);
      }

      if (query.verified !== undefined) {
        servers = servers.filter(server => server.verified === query.verified);
      }

      // 🐛 DEBUG: Final check if LibraLM survived all filtering
      const finalLibraLM = servers.find(server => server.id === 'ext_1588');
      console.log(`🔍 DEBUG: LibraLM (ext_1588) in final results:`, finalLibraLM ? 'YES' : 'NO');
      if (finalLibraLM) {
        console.log(`🔍 DEBUG: LibraLM final data:`, JSON.stringify(finalLibraLM, null, 2));
      }

      console.log(`Found ${servers.length} external servers from Smithery (after filtering)`);
      return servers;
    } catch (error: any) {
      console.error('Enhanced Postgres external servers error:', error.message);
      return [];
    }
  }

  async updateHealth(serverId: string, status: HealthStatus): Promise<void> {
    try {
      await sql`
        UPDATE mcp_servers
        SET last_health_check = ${status.lastCheck.toISOString()}
        WHERE id = ${serverId}
      `;

      // Record health metric
      if (status.responseTime) {
        await this.recordMetric({
          serverId,
          metricType: 'latency',
          value: status.responseTime,
          metadata: { healthy: status.healthy, error: status.error },
          recordedAt: new Date()
        });
      }

      if (!status.healthy && status.error) {
        await this.recordMetric({
          serverId,
          metricType: 'error',
          value: 1,
          metadata: { error: status.error },
          recordedAt: new Date()
        });
      }
    } catch (error: any) {
      console.error('Error updating health in enhanced Postgres:', error.message);
    }
  }

  async getHealth(serverId: string): Promise<HealthStatus | null> {
    try {
      const result = await sql`
        SELECT id, last_health_check FROM mcp_servers WHERE id = ${serverId}
      `;

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];

      // Get recent error count
      const errorCount = await sql`
        SELECT COUNT(*) as error_count
        FROM server_metrics
        WHERE server_id = ${serverId}
        AND metric_type = 'error'
        AND recorded_at > NOW() - INTERVAL '1 hour'
      `;

      return {
        serverId: row.id,
        healthy: errorCount.rows[0].error_count === '0',
        lastCheck: row.last_health_check ? new Date(row.last_health_check) : new Date()
      };
    } catch (error: any) {
      console.error('Error getting health from enhanced Postgres:', error.message);
      return null;
    }
  }

  async getAllServers(): Promise<MCPServerMetadata[]> {
    try {
      // TEMP FIX: Only return Smithery servers to test the complete system
      console.log('🧪 TEMP FIX: getAllServers returning ONLY Smithery servers for testing');
      const externalServers = await this.getExternalServers({});
      console.log(`Enhanced store getAllServers (TEMP): ${externalServers.length} Smithery servers only`);

      // 🔍 CHECK: Is LibraLM in the results?
      const hasLibraLM = externalServers.some(s => s.id === 'ext_1588');
      console.log(`🎯 LibraLM CHECK in getAllServers: ${hasLibraLM ? '✅ FOUND' : '❌ NOT FOUND'}`);
      if (hasLibraLM) {
        const libraLM = externalServers.find(s => s.id === 'ext_1588');
        console.log(`🎯 LibraLM details: name="${libraLM?.name}", verified=${libraLM?.verified}, category="${libraLM?.category}"`);
      }

      return externalServers;

      // TODO: Restore full implementation after testing:
      // const internalServers = await this.getInternalServers({});
      // const allServers = [...internalServers, ...externalServers];
      // return allServers;
    } catch (error: any) {
      console.error('Error getting all servers from enhanced Postgres:', error.message);
      return [];
    }
  }

  async delete(serverId: string): Promise<void> {
    try {
      // Cascading deletes will handle related records
      await sql`
        DELETE FROM mcp_servers WHERE id = ${serverId}
      `;
      console.log('Server deleted from enhanced Postgres:', serverId);
    } catch (error: any) {
      console.error('Error deleting server from enhanced Postgres:', error.message);
      throw error;
    }
  }

  async recordMetric(metric: ServerMetric): Promise<void> {
    try {
      await sql`
        INSERT INTO server_metrics (server_id, metric_type, value, metadata, recorded_at)
        VALUES (${metric.serverId}, ${metric.metricType}, ${metric.value},
                ${JSON.stringify(metric.metadata || {})}, ${metric.recordedAt.toISOString()})
      `;
    } catch (error: any) {
      console.error('Error recording metric:', error.message);
    }
  }

  async getMetrics(serverId: string, metricType?: string, since?: Date): Promise<ServerMetric[]> {
    try {
      let query = `
        SELECT * FROM server_metrics
        WHERE server_id = $1
      `;
      const params: any[] = [serverId];

      if (metricType) {
        query += ` AND metric_type = $${params.length + 1}`;
        params.push(metricType);
      }

      if (since) {
        query += ` AND recorded_at >= $${params.length + 1}`;
        params.push(since.toISOString());
      }

      query += ' ORDER BY recorded_at DESC LIMIT 1000';

      const result = await sql.query(query, params);

      return result.rows.map(row => ({
        id: row.id,
        serverId: row.server_id,
        metricType: row.metric_type,
        value: parseFloat(row.value),
        metadata: row.metadata,
        recordedAt: new Date(row.recorded_at)
      }));
    } catch (error: any) {
      console.error('Error getting metrics:', error.message);
      return [];
    }
  }
}