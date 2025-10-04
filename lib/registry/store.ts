import type { MCPServerMetadata, MCPServerRegistration, DiscoveryQuery, HealthStatus, ServerMetric } from '@/lib/types';
import { PostgresRegistryStore } from './postgres-store';
import { EnhancedPostgresRegistryStore } from './postgres-store-enhanced';
import { enhanceServerWithAuth } from '@/lib/auth';

export class RegistryStore {
  private postgresStore: PostgresRegistryStore;
  private enhancedPostgresStore?: EnhancedPostgresRegistryStore;
  private inMemoryStore: Map<string, MCPServerMetadata> = new Map();

  constructor() {
    this.postgresStore = new PostgresRegistryStore();
    // Only create enhanced store if explicitly enabled
    if (process.env.USE_ENHANCED_SCHEMA) {
      this.enhancedPostgresStore = new EnhancedPostgresRegistryStore();
    }
  }

  private get useInMemory(): boolean {
    // Use Postgres if environment variable is available
    const hasPostgresEnv = !!process.env.POSTGRES_URL;

    console.log('🔍 Storage Environment check:', {
      hasPostgres: hasPostgresEnv,
      useInMemory: !hasPostgresEnv,
      useEnhanced: !!process.env.USE_ENHANCED_SCHEMA,
      USE_ENHANCED_SCHEMA_value: process.env.USE_ENHANCED_SCHEMA,
      POSTGRES_URL_exists: !!process.env.POSTGRES_URL
    });

    return !hasPostgresEnv;
  }

  private get useEnhancedSchema(): boolean {
    // Use enhanced schema if explicitly enabled
    const enhanced = !!process.env.USE_ENHANCED_SCHEMA;
    console.log('🚀 Enhanced schema check:', {
      USE_ENHANCED_SCHEMA: process.env.USE_ENHANCED_SCHEMA,
      enhanced,
      typeof: typeof process.env.USE_ENHANCED_SCHEMA
    });
    return enhanced;
  }

  private get activeStore() {
    if (this.useInMemory) {
      return null;
    }
    return (this.useEnhancedSchema && this.enhancedPostgresStore) ? this.enhancedPostgresStore : this.postgresStore;
  }

  async register(server: any): Promise<void> {
    // Ensure category field exists for backward compatibility
    if (!server.category && server.categories?.[0]) {
      server.category = `${server.categories[0].mainCategory}/${server.categories[0].subCategory}`;
    } else if (!server.category) {
      server.category = 'Uncategorized';
    }

    if (this.useInMemory) {
      console.log('Registering server in memory:', server.id);
      this.inMemoryStore.set(server.id, server);
      return;
    }

    // Use appropriate Postgres storage
    return this.activeStore!.register(server);
  }

  async get(serverId: string): Promise<MCPServerMetadata | null> {
    if (this.useInMemory) {
      const server = this.inMemoryStore.get(serverId);
      return server ? enhanceServerWithAuth(server) : null;
    }

    const server = await this.activeStore!.get(serverId);
    return server ? enhanceServerWithAuth(server) : null;
  }

  async discover(query: DiscoveryQuery): Promise<MCPServerMetadata[]> {
    console.log('Discovery query:', query, 'useInMemory:', this.useInMemory);

    if (this.useInMemory) {
      // In-memory filtering
      const servers: MCPServerMetadata[] = [];
      for (const [id, server] of this.inMemoryStore) {
        if (this.matchesQuery(server, query)) {
          // Enhance server with auth information
          const enhancedServer = enhanceServerWithAuth(server);
          console.log(`🔑 AUTH ENHANCEMENT: ${server.name} (${server.id}) - Original endpoint: ${server.endpoint} → Enhanced endpoint: ${enhancedServer.endpoint}, apiKey: ${!!enhancedServer.apiKey}`);
          servers.push(enhancedServer);
        }
      }
      return servers.sort((a, b) => b.trustScore - a.trustScore);
    }

    // Use appropriate Postgres storage and enhance with auth
    const servers = await this.activeStore!.discover(query);
    return servers.map(server => {
      const enhancedServer = enhanceServerWithAuth(server);
      console.log(`🔑 AUTH ENHANCEMENT: ${server.name} (${server.id}) - Original endpoint: ${server.endpoint} → Enhanced endpoint: ${enhancedServer.endpoint}, apiKey: ${!!enhancedServer.apiKey}`);
      return enhancedServer;
    });
  }

  async updateHealth(serverId: string, status: HealthStatus): Promise<void> {
    if (this.useInMemory) {
      const server = this.inMemoryStore.get(serverId);
      if (!server) return;
      server.lastHealthCheck = status.lastCheck;
      this.inMemoryStore.set(serverId, server);
    } else {
      return this.activeStore!.updateHealth(serverId, status);
    }
  }

  async getHealth(serverId: string): Promise<HealthStatus | null> {
    if (this.useInMemory) {
      const server = this.inMemoryStore.get(serverId);
      if (!server) return null;
      return {
        serverId,
        healthy: true,
        lastCheck: server.lastHealthCheck || new Date()
      };
    }

    return this.activeStore!.getHealth(serverId);
  }

  async getAllServers(): Promise<MCPServerMetadata[]> {
    if (this.useInMemory) {
      const servers = Array.from(this.inMemoryStore.values());
      // Enhance all servers with auth information
      return servers.map(server => enhanceServerWithAuth(server));
    }

    // Get servers from Postgres and enhance with auth
    const servers = await this.activeStore!.getAllServers();
    return servers.map(server => enhanceServerWithAuth(server));
  }

  async getServersByIntentCategory(intentCategory: string): Promise<MCPServerMetadata[]> {
    if (this.useInMemory) {
      // For in-memory store, fall back to filtering all servers
      const allServers = await this.getAllServers();
      // This is a simplified fallback - in production we'd want proper semantic matching
      return allServers.filter(server => {
        // Simple fallback logic for testing
        if (intentCategory === 'time_query') {
          return server.capabilities.some(cap =>
            cap.includes('current_time') || cap.includes('get_time') || cap.includes('convert_time')
          ) || server.name.toLowerCase().includes('time');
        }
        return allServers; // Return all for other categories for now
      });
    }

    // Use the enhanced PostgreSQL store with semantic categorization
    const enhancedStore = this.activeStore as any;
    if (enhancedStore.getServersByIntentCategory) {
      const servers = await enhancedStore.getServersByIntentCategory(intentCategory);
      return servers.map((server: MCPServerMetadata) => enhanceServerWithAuth(server));
    }

    // Fallback to getAllServers if method doesn't exist
    console.warn(`getServersByIntentCategory not available, falling back to getAllServers`);
    return this.getAllServers();
  }

  async delete(serverId: string): Promise<void> {
    if (this.useInMemory) {
      this.inMemoryStore.delete(serverId);
    } else {
      return this.activeStore!.delete(serverId);
    }
  }

  private matchesQuery(server: MCPServerMetadata, query: DiscoveryQuery): boolean {
    if (query.capability && !server.capabilities.includes(query.capability)) {
      return false;
    }
    if (query.category) {
      // Check both old-style category field and new categories array
      const matchesOldStyle = server.category === query.category;
      const matchesNewStyle = server.categories?.some(c =>
        c.mainCategory === query.category || c.subCategory === query.category
      );
      if (!matchesOldStyle && !matchesNewStyle) {
        return false;
      }
    }
    if (query.verified !== undefined && server.verified !== query.verified) {
      return false;
    }
    return true;
  }

  async recordMetric(metric: ServerMetric): Promise<void> {
    if (this.useInMemory) {
      console.log('Metric recording not supported in memory mode');
      return;
    }

    if (this.useEnhancedSchema && this.enhancedPostgresStore) {
      return this.enhancedPostgresStore.recordMetric(metric);
    }
  }

  async getMetrics(serverId: string, metricType?: string, since?: Date): Promise<ServerMetric[]> {
    if (this.useInMemory) {
      return [];
    }

    if (this.useEnhancedSchema && this.enhancedPostgresStore) {
      return this.enhancedPostgresStore.getMetrics(serverId, metricType, since);
    }

    return [];
  }
}

// Singleton instance
export const registry = new RegistryStore();