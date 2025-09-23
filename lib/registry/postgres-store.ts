import { sql } from '@vercel/postgres';
import type { MCPServerMetadata, MCPServerRegistration, DiscoveryQuery, HealthStatus } from '@/lib/types';

export class PostgresRegistryStore {
  constructor() {
    this.initializeTables();
  }

  private async initializeTables() {
    try {
      // Create servers table
      await sql`
        CREATE TABLE IF NOT EXISTS mcp_servers (
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
        CREATE INDEX IF NOT EXISTS idx_mcp_servers_capabilities
        ON mcp_servers USING GIN (capabilities)
      `;

      // Create category index
      await sql`
        CREATE INDEX IF NOT EXISTS idx_mcp_servers_category
        ON mcp_servers (category)
      `;

      // Create verified index
      await sql`
        CREATE INDEX IF NOT EXISTS idx_mcp_servers_verified
        ON mcp_servers (verified)
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
        INSERT INTO mcp_servers (
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
        SELECT * FROM mcp_servers WHERE id = ${serverId}
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

      const queryText = `
        SELECT * FROM mcp_servers
        ${whereClause}
        ORDER BY trust_score DESC, created_at DESC
      `;

      const result = await sql.query(queryText, params);

      const servers = result.rows.map(row => ({
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
        UPDATE mcp_servers
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
        SELECT id, last_health_check FROM mcp_servers WHERE id = ${serverId}
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
      const result = await sql`
        SELECT * FROM mcp_servers
        ORDER BY trust_score DESC, created_at DESC
      `;

      return result.rows.map(row => ({
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
    } catch (error: any) {
      console.error('Error getting all servers from Postgres:', error.message);
      return [];
    }
  }

  async delete(serverId: string): Promise<void> {
    try {
      await sql`
        DELETE FROM mcp_servers WHERE id = ${serverId}
      `;
      console.log('Server deleted from Postgres:', serverId);
    } catch (error: any) {
      console.error('Error deleting server from Postgres:', error.message);
      throw error;
    }
  }
}