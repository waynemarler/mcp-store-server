import { kv } from '@vercel/kv';
import type { MCPServerMetadata, DiscoveryQuery, HealthStatus } from '@/lib/types';

export class RegistryStore {
  private readonly REGISTRY_KEY = 'mcp:registry:servers';
  private readonly CAPABILITY_INDEX = 'mcp:capability:';
  private readonly CATEGORY_INDEX = 'mcp:category:';
  private readonly HEALTH_KEY = 'mcp:health:';

  // For local development without Vercel KV, use in-memory storage
  private inMemoryStore: Map<string, MCPServerMetadata> = new Map();
  private useInMemory = !process.env.KV_REST_API_URL;

  async register(server: MCPServerMetadata): Promise<void> {
    if (this.useInMemory) {
      this.inMemoryStore.set(server.id, server);
      return;
    }

    await kv.hset(this.REGISTRY_KEY, server.id, JSON.stringify(server));

    // Index by capability
    for (const capability of server.capabilities) {
      await kv.sadd(`${this.CAPABILITY_INDEX}${capability}`, server.id);
    }

    // Index by category
    await kv.sadd(`${this.CATEGORY_INDEX}${server.category}`, server.id);
  }

  async get(serverId: string): Promise<MCPServerMetadata | null> {
    if (this.useInMemory) {
      return this.inMemoryStore.get(serverId) || null;
    }

    const data = await kv.hget(this.REGISTRY_KEY, serverId);
    return data ? JSON.parse(data as string) : null;
  }

  async discover(query: DiscoveryQuery): Promise<MCPServerMetadata[]> {
    if (this.useInMemory) {
      // In-memory filtering
      const servers: MCPServerMetadata[] = [];
      for (const [id, server] of this.inMemoryStore) {
        if (this.matchesQuery(server, query)) {
          servers.push(server);
        }
      }
      return servers.sort((a, b) => b.trustScore - a.trustScore);
    } else {
      // KV-based filtering
      let serverIds: Set<string> = new Set();

      if (query.capability) {
        const ids = await kv.smembers(`${this.CAPABILITY_INDEX}${query.capability}`);
        ids.forEach(id => serverIds.add(id as string));
      } else if (query.category) {
        const ids = await kv.smembers(`${this.CATEGORY_INDEX}${query.category}`);
        ids.forEach(id => serverIds.add(id as string));
      } else {
        // Get all servers
        const allServers = await kv.hgetall(this.REGISTRY_KEY);
        if (allServers) {
          serverIds = new Set(Object.keys(allServers));
        }
      }

      // Fetch metadata for each server
      const servers: MCPServerMetadata[] = [];
      for (const id of serverIds) {
        const server = await this.get(id);
        if (server && this.matchesQuery(server, query)) {
          servers.push(server);
        }
      }

      // Sort by trust score
      return servers.sort((a, b) => b.trustScore - a.trustScore);
    }
  }

  async updateHealth(serverId: string, status: HealthStatus): Promise<void> {
    const server = await this.get(serverId);
    if (!server) return;

    server.lastHealthCheck = status.lastCheck;

    if (this.useInMemory) {
      this.inMemoryStore.set(serverId, server);
    } else {
      await kv.hset(this.REGISTRY_KEY, serverId, JSON.stringify(server));
      await kv.set(`${this.HEALTH_KEY}${serverId}`, JSON.stringify(status), {
        ex: 300 // Expire after 5 minutes
      });
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

    const data = await kv.get(`${this.HEALTH_KEY}${serverId}`);
    return data ? JSON.parse(data as string) : null;
  }

  async getAllServers(): Promise<MCPServerMetadata[]> {
    if (this.useInMemory) {
      return Array.from(this.inMemoryStore.values());
    }

    const allServers = await kv.hgetall(this.REGISTRY_KEY);
    if (!allServers) return [];

    return Object.values(allServers).map(data =>
      JSON.parse(data as string)
    );
  }

  async delete(serverId: string): Promise<void> {
    const server = await this.get(serverId);
    if (!server) return;

    if (this.useInMemory) {
      this.inMemoryStore.delete(serverId);
    } else {
      await kv.hdel(this.REGISTRY_KEY, serverId);

      // Remove from indices
      for (const capability of server.capabilities) {
        await kv.srem(`${this.CAPABILITY_INDEX}${capability}`, serverId);
      }
      await kv.srem(`${this.CATEGORY_INDEX}${server.category}`, serverId);
      await kv.del(`${this.HEALTH_KEY}${serverId}`);
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