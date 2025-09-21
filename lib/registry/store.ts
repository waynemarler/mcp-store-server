import type { MCPServerMetadata, DiscoveryQuery, HealthStatus } from '@/lib/types';
import { PostgresRegistryStore } from './postgres-store';

export class RegistryStore {
  private postgresStore: PostgresRegistryStore;
  private inMemoryStore: Map<string, MCPServerMetadata> = new Map();

  constructor() {
    this.postgresStore = new PostgresRegistryStore();
  }

  private get useInMemory(): boolean {
    // Use Postgres if environment variable is available
    const hasPostgresEnv = !!process.env.POSTGRES_URL;

    console.log('Storage Environment check:', {
      hasPostgres: hasPostgresEnv,
      useInMemory: !hasPostgresEnv
    });

    return !hasPostgresEnv;
  }

  async register(server: MCPServerMetadata): Promise<void> {
    if (this.useInMemory) {
      console.log('Registering server in memory:', server.id);
      this.inMemoryStore.set(server.id, server);
      return;
    }

    // Use Postgres storage
    return this.postgresStore.register(server);
  }

  async get(serverId: string): Promise<MCPServerMetadata | null> {
    if (this.useInMemory) {
      return this.inMemoryStore.get(serverId) || null;
    }

    return this.postgresStore.get(serverId);
  }

  async discover(query: DiscoveryQuery): Promise<MCPServerMetadata[]> {
    console.log('Discovery query:', query, 'useInMemory:', this.useInMemory);

    if (this.useInMemory) {
      // In-memory filtering
      const servers: MCPServerMetadata[] = [];
      for (const [id, server] of this.inMemoryStore) {
        if (this.matchesQuery(server, query)) {
          servers.push(server);
        }
      }
      return servers.sort((a, b) => b.trustScore - a.trustScore);
    }

    // Use Postgres storage
    return this.postgresStore.discover(query);
  }

  async updateHealth(serverId: string, status: HealthStatus): Promise<void> {
    if (this.useInMemory) {
      const server = this.inMemoryStore.get(serverId);
      if (!server) return;
      server.lastHealthCheck = status.lastCheck;
      this.inMemoryStore.set(serverId, server);
    } else {
      return this.postgresStore.updateHealth(serverId, status);
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

    return this.postgresStore.getHealth(serverId);
  }

  async getAllServers(): Promise<MCPServerMetadata[]> {
    if (this.useInMemory) {
      return Array.from(this.inMemoryStore.values());
    }

    return this.postgresStore.getAllServers();
  }

  async delete(serverId: string): Promise<void> {
    if (this.useInMemory) {
      this.inMemoryStore.delete(serverId);
    } else {
      return this.postgresStore.delete(serverId);
    }
  }

  private matchesQuery(server: MCPServerMetadata, query: DiscoveryQuery): boolean {
    if (query.capability && !server.capabilities.includes(query.capability)) {
      return false;
    }
    if (query.category && server.category !== query.category) {
      return false;
    }
    if (query.verified !== undefined && server.verified !== query.verified) {
      return false;
    }
    return true;
  }
}

// Singleton instance
export const registry = new RegistryStore();