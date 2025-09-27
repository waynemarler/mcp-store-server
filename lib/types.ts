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
  author?: Author;
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
  // Smithery-specific fields
  display_name?: string;
  qualified_name?: string;
  icon_url?: string;
  use_count?: number;
  homepage?: string;
  repository_url?: string;
  source_url?: string;
  tools?: any[];
  is_remote?: boolean;
  security_scan_passed?: boolean;
  deployment_url?: string;
  connections?: any[];
  downloads?: number;
  source_created_at?: string;
  fetched_at?: string;
  api_source?: string;
  raw_json?: any;
}

// Interface for creating servers with partial author data
export interface MCPServerRegistration {
  id: string;
  name: string;
  description?: string;
  logoUrl?: string;
  endpoint: string;
  apiKey?: string;
  type?: 'informational' | 'transactional' | 'task';
  version?: string;
  author?: PartialAuthor;
  authorId?: number;
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
  status?: 'discovered' | 'active' | 'all';
  minTrustScore?: number;
  includeInactive?: boolean;
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

// New: Two-tier system types
export interface DiscoveredServer {
  id: string;
  status: 'discovered' | 'contacted' | 'approved' | 'rejected';
  activated: boolean;

  // GitHub repository info
  repository: {
    owner: string;
    name: string;
    fullName: string;
    url: string;
    stars: number;
    forks: number;
    language?: string;
    description?: string;
    updatedAt: string;
  };

  // Our analysis
  analysis: {
    confidence: number;
    indicators: string[];
    hasManifest: boolean;
    manifestPath?: string;
    inferredName?: string;
    inferredDescription?: string;
    inferredCapabilities?: string[];
    inferredCategories?: string[];
    inferredTags?: string[];
    trustScore?: number;
  };

  // Developer engagement tracking
  developer: {
    githubUsername: string;
    contactEmail?: string;
    contactAttempts: ContactAttempt[];
    approvalRequested: boolean;
    approvedAt?: Date;
    rejectedAt?: Date;
    rejectionReason?: string;
  };

  // If approved and activated
  activeServerId?: string; // Links to MCPServerMetadata

  discoveredAt: Date;
  lastContactAt?: Date;
  activatedAt?: Date;
}

export interface ContactAttempt {
  id: string;
  method: 'email' | 'github-issue' | 'github-discussion';
  sentAt: Date;
  template: string;
  successful: boolean;
  response?: string;
  responseAt?: Date;
}

// Developer portal types
export interface DeveloperProfile {
  id: string;
  githubUsername: string;
  githubId: number;
  email?: string;
  name?: string;
  avatarUrl?: string;
  website?: string;
  connectedRepositories: string[]; // Repository full names
  activeServers: string[]; // Active server IDs
  discoveredServers: string[]; // Discovered server IDs
  joinedAt: Date;
  lastLoginAt: Date;
}

export interface RepositoryConnection {
  id: string;
  developerId: string;
  repository: {
    owner: string;
    name: string;
    fullName: string;
  };
  analysisResult?: {
    confidence: number;
    hasManifest: boolean;
    capabilities: string[];
  };
  registrationStatus: 'none' | 'pending' | 'completed';
  registeredServerId?: string;
  connectedAt: Date;
}