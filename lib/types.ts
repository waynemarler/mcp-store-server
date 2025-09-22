export interface Author {
  id: number;
  name: string;
  website?: string;
  contactEmail?: string;
  createdAt: Date;
}

export interface PartialAuthor {
  name: string;
  website?: string;
  contactEmail?: string;
}

export interface Category {
  id: number;
  mainCategory: string;
  subCategory: string;
  description?: string;
}

export interface MCPServerMetadata {
  id: string;
  name: string;
  description?: string;
  logoUrl?: string;
  endpoint: string;
  apiKey?: string;
  type?: 'informational' | 'transactional' | 'task';
  version?: string;
  author?: any;
  authorId?: number;
  // Legacy field for backward compatibility
  category: string;
  categories?: Category[];
  capabilities: string[];
  tags?: string[];
  verified: boolean;
  trustScore: number;
  status: 'active' | 'inactive' | 'deprecated';
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

export interface ServerMetric {
  id?: number;
  serverId: string;
  metricType: 'request' | 'error' | 'latency';
  value: number;
  metadata?: any;
  recordedAt: Date;
}