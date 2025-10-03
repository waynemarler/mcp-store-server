import { sql } from '@vercel/postgres';
import type { MCPServerMetadata, MCPServerRegistration, DiscoveryQuery, HealthStatus } from '@/lib/types';

export class PostgresRegistryStore {
  constructor() {
    this.initializeTables();
  }

  private async initializeTables() {
    try {
      // Create internal servers table
      await sql`
        CREATE TABLE IF NOT EXISTS internal_mcp_servers (
          id VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          category VARCHAR(255) NOT NULL,
          capabilities JSONB NOT NULL,
          endpoint VARCHAR(255) NOT NULL,
          api_key VARCHAR(255),
          verified BOOLEAN DEFAULT FALSE,
          trust_score INTEGER DEFAULT 50,
          last_health_check TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;

      // Create capability index
      await sql`
        CREATE INDEX IF NOT EXISTS idx_internal_mcp_servers_capabilities
        ON internal_mcp_servers USING GIN (capabilities)
      `;

      // Create category index
      await sql`
        CREATE INDEX IF NOT EXISTS idx_internal_mcp_servers_category
        ON internal_mcp_servers (category)
      `;

      // Create verified index
      await sql`
        CREATE INDEX IF NOT EXISTS idx_internal_mcp_servers_verified
        ON internal_mcp_servers (verified)
      `;

      console.log('Postgres tables initialized successfully');
    } catch (error: any) {
      console.error('Error initializing Postgres tables:', error.message);
    }
  }

  async register(server: any): Promise<void> {
    try {
      console.log('Registering server in Postgres:', server.id);

      await sql`
        INSERT INTO internal_mcp_servers (
          id, name, description, category, capabilities, endpoint,
          api_key, verified, trust_score, created_at, updated_at
        ) VALUES (
          ${server.id}, ${server.name}, ${server.description || null},
          ${server.category}, ${JSON.stringify(server.capabilities)},
          ${server.endpoint}, ${server.apiKey || null}, ${server.verified},
          ${server.trustScore}, ${server.createdAt.toISOString()},
          ${server.updatedAt.toISOString()}
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          category = EXCLUDED.category,
          capabilities = EXCLUDED.capabilities,
          endpoint = EXCLUDED.endpoint,
          api_key = EXCLUDED.api_key,
          verified = EXCLUDED.verified,
          trust_score = EXCLUDED.trust_score,
          updated_at = EXCLUDED.updated_at
      `;

      console.log('Server registered successfully in Postgres');
    } catch (error: any) {
      console.error('Postgres registration error:', {
        error: error.message,
        serverId: server.id,
        operation: 'register'
      });
      throw error;
    }
  }

  async get(serverId: string): Promise<MCPServerMetadata | null> {
    try {
      const result = await sql`
        SELECT * FROM internal_mcp_servers WHERE id = ${serverId}
      `;

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        name: row.name,
        description: row.description,
        category: row.category,
        capabilities: row.capabilities,
        endpoint: row.endpoint,
        apiKey: row.api_key,
        verified: row.verified,
        trustScore: row.trust_score,
        status: 'active', // Default status for simple schema
        lastHealthCheck: row.last_health_check ? new Date(row.last_health_check) : undefined,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      };
    } catch (error: any) {
      console.error('Error getting server from Postgres:', error.message);
      return null;
    }
  }

  async discover(query: DiscoveryQuery): Promise<MCPServerMetadata[]> {
    try {
      console.log('Postgres discovery query:', query);

      let whereClause = 'WHERE 1=1';
      const params: any[] = [];

      if (query.capability) {
        whereClause += ` AND capabilities @> $${params.length + 1}`;
        params.push(JSON.stringify([query.capability]));
      }

      if (query.category) {
        whereClause += ` AND category = $${params.length + 1}`;
        params.push(query.category);
      }

      if (query.verified !== undefined) {
        whereClause += ` AND verified = $${params.length + 1}`;
        params.push(query.verified);
      }

      // Query both internal and external servers (internal_mcp_servers is currently empty)
      const [internalResult, externalResult] = await Promise.allSettled([
        // Internal servers (currently empty) - skip if table doesn't exist
        (async () => {
          try {
            return await sql.query(`
              SELECT * FROM internal_mcp_servers
              ${whereClause}
              ORDER BY trust_score DESC, created_at DESC
            `, params);
          } catch (error: any) {
            console.log('Internal servers table not ready:', error.message);
            return { rows: [] };
          }
        })(),
        // External servers from Smithery
        sql.query(`
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
            source_created_at as created_at, updated_at
          FROM smithery_mcp_servers
          ${whereClause.replace('capabilities @>', 'tools @>')}
          ORDER BY use_count DESC, source_created_at DESC
        `, params)
      ]);

      const servers: MCPServerMetadata[] = [];

      // Add internal servers if successful
      if (internalResult.status === 'fulfilled') {
        const internalServers = internalResult.value.rows.map(row => ({
          id: row.id,
          name: row.name,
          description: row.description,
          category: row.category,
          capabilities: row.capabilities,
          endpoint: row.endpoint,
          apiKey: row.api_key,
          verified: row.verified,
          trustScore: row.trust_score,
          status: 'active' as const,
          lastHealthCheck: row.last_health_check ? new Date(row.last_health_check) : undefined,
          createdAt: new Date(row.created_at),
          updatedAt: new Date(row.updated_at)
        }));
        servers.push(...internalServers);
      }

      // Add external servers if successful
      if (externalResult.status === 'fulfilled') {
        const externalServers = externalResult.value.rows.map(row => ({
          id: row.id,
          name: row.name,
          description: row.description,
          category: row.category,
          capabilities: row.capabilities,
          endpoint: row.endpoint,
          apiKey: null,
          verified: row.verified,
          trustScore: row.trust_score,
          status: 'active' as const,
          lastHealthCheck: row.last_health_check ? new Date(row.last_health_check) : undefined,
          createdAt: new Date(row.created_at),
          updatedAt: new Date(row.updated_at)
        }));
        servers.push(...externalServers);
      }

      console.log(`Found ${servers.length} servers in Postgres`);
      return servers;
    } catch (error: any) {
      console.error('Postgres discovery error:', error.message);
      return [];
    }
  }

  async updateHealth(serverId: string, status: HealthStatus): Promise<void> {
    try {
      await sql`
        UPDATE internal_mcp_servers
        SET last_health_check = ${status.lastCheck.toISOString()}
        WHERE id = ${serverId}
      `;
    } catch (error: any) {
      console.error('Error updating health in Postgres:', error.message);
    }
  }

  async getHealth(serverId: string): Promise<HealthStatus | null> {
    try {
      const result = await sql`
        SELECT id, last_health_check FROM internal_mcp_servers WHERE id = ${serverId}
      `;

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        serverId: row.id,
        healthy: true, // Assume healthy if in database
        lastCheck: row.last_health_check ? new Date(row.last_health_check) : new Date()
      };
    } catch (error: any) {
      console.error('Error getting health from Postgres:', error.message);
      return null;
    }
  }

  async getAllServers(): Promise<MCPServerMetadata[]> {
    try {
      // Get both internal and external servers
      const [internalResult, externalResult] = await Promise.allSettled([
        (async () => {
          try {
            return await sql`
              SELECT
                id, name, description, category, capabilities, endpoint,
                api_key, verified, trust_score, last_health_check,
                created_at, updated_at, 'internal' as source
              FROM internal_mcp_servers
              ORDER BY trust_score DESC, created_at DESC
            `;
          } catch (error: any) {
            console.log('Internal servers table not ready in getAllServers:', error.message);
            return { rows: [] };
          }
        })(),
        sql`
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
        `
      ]);

      const servers: MCPServerMetadata[] = [];

      // Add internal servers
      if (internalResult.status === 'fulfilled') {
        servers.push(...internalResult.value.rows.map(row => ({
          id: row.id,
          name: row.name,
          description: row.description,
          category: row.category,
          capabilities: row.capabilities,
          endpoint: row.endpoint,
          apiKey: row.api_key,
          verified: row.verified,
          trustScore: row.trust_score,
          status: 'active' as const,
          lastHealthCheck: row.last_health_check ? new Date(row.last_health_check) : undefined,
          createdAt: new Date(row.created_at),
          updatedAt: new Date(row.updated_at)
        })));
      }

      // Add external servers
      if (externalResult.status === 'fulfilled') {
        servers.push(...externalResult.value.rows.map(row => ({
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
        })));
      }

      console.log(`Found ${servers.length} servers total (internal + external)`);
      return servers.sort((a, b) => b.trustScore - a.trustScore);
    } catch (error: any) {
      console.error('Error getting all servers from Postgres:', error.message);
      return [];
    }
  }

  async delete(serverId: string): Promise<void> {
    try {
      await sql`
        DELETE FROM internal_mcp_servers WHERE id = ${serverId}
      `;
      console.log('Server deleted from Postgres:', serverId);
    } catch (error: any) {
      console.error('Error deleting server from Postgres:', error.message);
      throw error;
    }
  }
}