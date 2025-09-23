import { sql } from '@vercel/postgres';
import type { DiscoveredServer, ContactAttempt } from '@/lib/types';
import type { MCPServerCandidate } from '@/lib/github/discovery';

export class DiscoveredServerStore {
  constructor() {
    this.initializeTables();
  }

  private async initializeTables() {
    try {
      // Create discovered_servers table
      await sql`
        CREATE TABLE IF NOT EXISTS discovered_servers (
          id VARCHAR(255) PRIMARY KEY,
          status VARCHAR(50) NOT NULL DEFAULT 'discovered',
          activated BOOLEAN DEFAULT FALSE,

          -- Repository info (JSONB for flexibility)
          repository JSONB NOT NULL,

          -- Our analysis
          analysis JSONB NOT NULL,

          -- Developer info
          developer JSONB NOT NULL,

          -- Links to active server if approved
          active_server_id VARCHAR(255),

          -- Timestamps
          discovered_at TIMESTAMP DEFAULT NOW(),
          last_contact_at TIMESTAMP,
          activated_at TIMESTAMP,

          -- Indexes
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `;

      // Create contact_attempts table
      await sql`
        CREATE TABLE IF NOT EXISTS contact_attempts (
          id VARCHAR(255) PRIMARY KEY,
          discovered_server_id VARCHAR(255) NOT NULL,
          method VARCHAR(50) NOT NULL,
          sent_at TIMESTAMP NOT NULL,
          template VARCHAR(255) NOT NULL,
          successful BOOLEAN DEFAULT FALSE,
          response TEXT,
          response_at TIMESTAMP,

          FOREIGN KEY (discovered_server_id) REFERENCES discovered_servers(id) ON DELETE CASCADE
        )
      `;

      // Create indexes for efficient querying
      await sql`CREATE INDEX IF NOT EXISTS idx_discovered_servers_status ON discovered_servers(status)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_discovered_servers_activated ON discovered_servers(activated)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_discovered_servers_github_username ON discovered_servers((developer->>'githubUsername'))`;
      await sql`CREATE INDEX IF NOT EXISTS idx_discovered_servers_confidence ON discovered_servers((analysis->>'confidence'))`;
      await sql`CREATE INDEX IF NOT EXISTS idx_discovered_servers_stars ON discovered_servers((repository->>'stars'))`;

      console.log('Discovered servers tables initialized successfully');
    } catch (error: any) {
      console.error('Error initializing discovered servers tables:', error.message);
    }
  }

  /**
   * Store a discovered server from GitHub analysis
   */
  async storeDiscoveredServer(candidate: MCPServerCandidate): Promise<string> {
    try {
      const id = `discovered-${candidate.repository.owner.login}-${candidate.repository.name}`;

      const discoveredServer: Omit<DiscoveredServer, 'discoveredAt' | 'lastContactAt' | 'activatedAt'> = {
        id,
        status: 'discovered',
        activated: false,
        repository: {
          owner: candidate.repository.owner.login,
          name: candidate.repository.name,
          fullName: candidate.repository.full_name,
          url: candidate.repository.html_url,
          stars: candidate.repository.stargazers_count,
          forks: candidate.repository.forks_count,
          language: candidate.repository.language || undefined,
          description: candidate.repository.description || undefined,
          updatedAt: candidate.repository.updated_at
        },
        analysis: {
          confidence: candidate.detection.confidence,
          indicators: candidate.detection.indicators,
          hasManifest: candidate.detection.hasManifest,
          manifestPath: candidate.detection.manifestPath,
          inferredName: candidate.analysis?.inferredName,
          inferredDescription: candidate.analysis?.inferredDescription,
          inferredCapabilities: candidate.analysis?.inferredCapabilities,
          inferredCategories: candidate.analysis?.inferredCategories,
          inferredTags: candidate.analysis?.inferredTags,
          trustScore: candidate.repository.stargazers_count > 100 ?
            Math.min(50 + Math.log10(candidate.repository.stargazers_count) * 10, 95) :
            Math.max(20, candidate.detection.confidence * 50)
        },
        developer: {
          githubUsername: candidate.repository.owner.login,
          contactAttempts: [],
          approvalRequested: false
        }
      };

      await sql`
        INSERT INTO discovered_servers (
          id, status, activated, repository, analysis, developer,
          discovered_at, created_at, updated_at
        ) VALUES (
          ${id},
          ${discoveredServer.status},
          ${discoveredServer.activated},
          ${JSON.stringify(discoveredServer.repository)},
          ${JSON.stringify(discoveredServer.analysis)},
          ${JSON.stringify(discoveredServer.developer)},
          NOW(),
          NOW(),
          NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          repository = EXCLUDED.repository,
          analysis = EXCLUDED.analysis,
          updated_at = NOW()
      `;

      console.log(`Stored discovered server: ${id}`);
      return id;
    } catch (error: any) {
      console.error('Error storing discovered server:', error.message);
      throw error;
    }
  }

  /**
   * Get all discovered servers with filtering
   */
  async getDiscoveredServers(options: {
    status?: 'discovered' | 'contacted' | 'approved' | 'rejected';
    minConfidence?: number;
    minStars?: number;
    limit?: number;
    offset?: number;
  } = {}): Promise<DiscoveredServer[]> {
    try {
      const {
        status,
        minConfidence = 0,
        minStars = 0,
        limit = 50,
        offset = 0
      } = options;

      let whereClause = `WHERE (analysis->>'confidence')::float >= ${minConfidence}
                         AND (repository->>'stars')::int >= ${minStars}`;

      if (status) {
        whereClause += ` AND status = '${status}'`;
      }

      const result = await sql.query(`
        SELECT * FROM discovered_servers
        ${whereClause}
        ORDER BY (repository->>'stars')::int DESC, (analysis->>'confidence')::float DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      return result.rows.map(row => ({
        id: row.id,
        status: row.status,
        activated: row.activated,
        repository: row.repository,
        analysis: row.analysis,
        developer: row.developer,
        activeServerId: row.active_server_id,
        discoveredAt: new Date(row.discovered_at),
        lastContactAt: row.last_contact_at ? new Date(row.last_contact_at) : undefined,
        activatedAt: row.activated_at ? new Date(row.activated_at) : undefined
      }));
    } catch (error: any) {
      console.error('Error getting discovered servers:', error.message);
      return [];
    }
  }

  /**
   * Get a specific discovered server
   */
  async getDiscoveredServer(id: string): Promise<DiscoveredServer | null> {
    try {
      const result = await sql`
        SELECT * FROM discovered_servers WHERE id = ${id}
      `;

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        status: row.status,
        activated: row.activated,
        repository: row.repository,
        analysis: row.analysis,
        developer: row.developer,
        activeServerId: row.active_server_id,
        discoveredAt: new Date(row.discovered_at),
        lastContactAt: row.last_contact_at ? new Date(row.last_contact_at) : undefined,
        activatedAt: row.activated_at ? new Date(row.activated_at) : undefined
      };
    } catch (error: any) {
      console.error('Error getting discovered server:', error.message);
      return null;
    }
  }

  /**
   * Update discovered server status
   */
  async updateServerStatus(
    id: string,
    status: 'discovered' | 'contacted' | 'approved' | 'rejected',
    metadata?: {
      activeServerId?: string;
      rejectionReason?: string;
    }
  ): Promise<void> {
    try {
      let updateFields = `status = ${status}, updated_at = NOW()`;

      if (status === 'contacted') {
        updateFields += `, last_contact_at = NOW()`;
      }

      if (status === 'approved' && metadata?.activeServerId) {
        updateFields += `, activated = TRUE, activated_at = NOW(), active_server_id = '${metadata.activeServerId}'`;
      }

      if (status === 'rejected' && metadata?.rejectionReason) {
        // Update developer object with rejection reason
        await sql.query(`
          UPDATE discovered_servers
          SET developer = jsonb_set(developer, '{rejectionReason}', '"${metadata.rejectionReason}"'),
              developer = jsonb_set(developer, '{rejectedAt}', '"${new Date().toISOString()}"'),
              ${updateFields}
          WHERE id = '${id}'
        `);
      } else {
        await sql.query(`
          UPDATE discovered_servers
          SET ${updateFields}
          WHERE id = '${id}'
        `);
      }

      console.log(`Updated server ${id} status to ${status}`);
    } catch (error: any) {
      console.error('Error updating server status:', error.message);
      throw error;
    }
  }

  /**
   * Record a contact attempt
   */
  async recordContactAttempt(
    discoveredServerId: string,
    attempt: Omit<ContactAttempt, 'id'>
  ): Promise<void> {
    try {
      const attemptId = `contact-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      await sql`
        INSERT INTO contact_attempts (
          id, discovered_server_id, method, sent_at, template, successful, response, response_at
        ) VALUES (
          ${attemptId},
          ${discoveredServerId},
          ${attempt.method},
          ${attempt.sentAt.toISOString()},
          ${attempt.template},
          ${attempt.successful},
          ${attempt.response || null},
          ${attempt.responseAt?.toISOString() || null}
        )
      `;

      // Update the last contact time
      await sql`
        UPDATE discovered_servers
        SET last_contact_at = NOW(), updated_at = NOW()
        WHERE id = ${discoveredServerId}
      `;

      console.log(`Recorded contact attempt for ${discoveredServerId}`);
    } catch (error: any) {
      console.error('Error recording contact attempt:', error.message);
      throw error;
    }
  }

  /**
   * Get statistics about discovered servers
   */
  async getDiscoveryStats(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    totalStars: number;
    averageConfidence: number;
    topLanguages: Array<{ language: string; count: number }>;
  }> {
    try {
      // Get total and by status
      const statusResult = await sql`
        SELECT status, COUNT(*) as count
        FROM discovered_servers
        GROUP BY status
      `;

      const total = statusResult.rows.reduce((sum, row) => sum + parseInt(row.count), 0);
      const byStatus = statusResult.rows.reduce((acc, row) => {
        acc[row.status] = parseInt(row.count);
        return acc;
      }, {} as Record<string, number>);

      // Get total stars and average confidence
      const statsResult = await sql`
        SELECT
          SUM((repository->>'stars')::int) as total_stars,
          AVG((analysis->>'confidence')::float) as avg_confidence
        FROM discovered_servers
      `;

      const totalStars = parseInt(statsResult.rows[0]?.total_stars || '0');
      const averageConfidence = parseFloat(statsResult.rows[0]?.avg_confidence || '0');

      // Get top languages
      const languageResult = await sql`
        SELECT
          repository->>'language' as language,
          COUNT(*) as count
        FROM discovered_servers
        WHERE repository->>'language' IS NOT NULL
        GROUP BY repository->>'language'
        ORDER BY count DESC
        LIMIT 10
      `;

      const topLanguages = languageResult.rows.map(row => ({
        language: row.language,
        count: parseInt(row.count)
      }));

      return {
        total,
        byStatus,
        totalStars,
        averageConfidence,
        topLanguages
      };
    } catch (error: any) {
      console.error('Error getting discovery stats:', error.message);
      return {
        total: 0,
        byStatus: {},
        totalStars: 0,
        averageConfidence: 0,
        topLanguages: []
      };
    }
  }

  /**
   * Batch store multiple discovered servers
   */
  async batchStoreDiscoveredServers(candidates: MCPServerCandidate[]): Promise<string[]> {
    const storedIds: string[] = [];

    for (const candidate of candidates) {
      try {
        const id = await this.storeDiscoveredServer(candidate);
        storedIds.push(id);
      } catch (error) {
        console.error(`Failed to store candidate ${candidate.repository.full_name}:`, error);
      }
    }

    return storedIds;
  }
}

// Singleton instance
export const discoveredServerStore = new DiscoveredServerStore();