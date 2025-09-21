export interface MCPServerMetadata {
  id: string;
  name: string;
  description?: string;
  category: string;
  capabilities: string[];
  endpoint: string;
  apiKey?: string;
  verified: boolean;
  trustScore: number;
  lastHealthCheck?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface RouteRequest {
  capability: string;
  method: string;
  params?: any;
  preferredServer?: string;
}

export interface RouteResponse {
  serverId: string;
  serverName: string;
  response: any;
  executionTime: number;
}

export interface DiscoveryQuery {
  capability?: string;
  category?: string;
  verified?: boolean;
}

export interface HealthStatus {
  serverId: string;
  healthy: boolean;
  lastCheck: Date;
  responseTime?: number;
  error?: string;
}