import { Octokit } from '@octokit/rest';

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  clone_url: string;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  updated_at: string;
  owner: {
    login: string;
    avatar_url: string;
  };
}

export interface MCPServerCandidate {
  repository: GitHubRepository;
  detection: {
    hasManifest: boolean;
    manifestPath?: string;
    manifestContent?: any;
    confidence: number;
    indicators: string[];
  };
  analysis?: {
    inferredName?: string;
    inferredDescription?: string;
    inferredCapabilities?: string[];
    inferredCategories?: string[];
    inferredTags?: string[];
  };
}

export class GitHubDiscoveryService {
  private octokit: Octokit;

  constructor(token?: string) {
    this.octokit = new Octokit({
      auth: token || process.env.GITHUB_TOKEN,
    });
  }

  /**
   * Search GitHub for repositories that might contain MCP servers
   */
  async searchMCPRepositories(options: {
    query?: string;
    sort?: 'stars' | 'updated' | 'forks' | 'help-wanted-issues';
    order?: 'asc' | 'desc';
    per_page?: number;
    page?: number;
  } = {}): Promise<GitHubRepository[]> {
    const {
      query = 'mcp server OR "model context protocol" OR mcp.json',
      sort = 'updated',
      order = 'desc',
      per_page = 30,
      page = 1
    } = options;

    try {
      const response = await this.octokit.rest.search.repos({
        q: query,
        sort,
        order,
        per_page,
        page
      });

      return response.data.items as GitHubRepository[];
    } catch (error) {
      console.error('Error searching GitHub repositories:', error);
      return [];
    }
  }

  /**
   * Detect if a repository contains an MCP server
   */
  async detectMCPServer(owner: string, repo: string): Promise<MCPServerCandidate | null> {
    try {
      const repository = await this.getRepository(owner, repo);
      if (!repository) return null;

      const detection = await this.analyzeMCPIndicators(owner, repo);

      if (detection.confidence < 0.3) {
        return null; // Not confident this is an MCP server
      }

      const candidate: MCPServerCandidate = {
        repository,
        detection
      };

      // If we have a manifest, parse it
      if (detection.hasManifest && detection.manifestContent) {
        candidate.analysis = await this.analyzeManifest(detection.manifestContent);
      } else {
        // AI-powered inference from repository content
        candidate.analysis = await this.inferMCPDetails(owner, repo, repository);
      }

      return candidate;
    } catch (error) {
      console.error(`Error detecting MCP server in ${owner}/${repo}:`, error);
      return null;
    }
  }

  /**
   * Get repository details
   */
  private async getRepository(owner: string, repo: string): Promise<GitHubRepository | null> {
    try {
      const response = await this.octokit.rest.repos.get({
        owner,
        repo
      });
      return response.data as GitHubRepository;
    } catch (error) {
      console.error(`Error fetching repository ${owner}/${repo}:`, error);
      return null;
    }
  }

  /**
   * Analyze repository for MCP indicators
   */
  private async analyzeMCPIndicators(owner: string, repo: string): Promise<{
    hasManifest: boolean;
    manifestPath?: string;
    manifestContent?: any;
    confidence: number;
    indicators: string[];
  }> {
    const indicators: string[] = [];
    let confidence = 0;
    let hasManifest = false;
    let manifestPath: string | undefined;
    let manifestContent: any = undefined;

    // Check for manifest files
    const manifestPaths = [
      'mcp.json',
      '.mcp/config.json',
      'mcp-server.json',
      'package.json'
    ];

    for (const path of manifestPaths) {
      try {
        const response = await this.octokit.rest.repos.getContent({
          owner,
          repo,
          path
        });

        if (Array.isArray(response.data)) continue;

        // Type guard to ensure this is a file with content
        if (response.data.type !== 'file' || !('content' in response.data)) continue;

        const content = Buffer.from(response.data.content, 'base64').toString();
        const parsed = JSON.parse(content);

        // Check if it's an MCP manifest
        if (path === 'package.json') {
          if (parsed.mcp || parsed.keywords?.includes('mcp') || parsed.name?.includes('mcp')) {
            hasManifest = true;
            manifestPath = path;
            manifestContent = parsed.mcp || parsed;
            confidence += 0.8;
            indicators.push('package.json with MCP references');
          }
        } else {
          // Direct MCP manifest files
          hasManifest = true;
          manifestPath = path;
          manifestContent = parsed;
          confidence += 0.9;
          indicators.push(`Found ${path} manifest`);
        }
        break;
      } catch (error) {
        // File not found, continue
      }
    }

    // Check for common MCP server patterns
    try {
      // Look for server files
      const serverFiles = ['server.js', 'server.ts', 'index.js', 'index.ts', 'src/server.ts', 'src/index.ts'];
      for (const file of serverFiles) {
        try {
          const response = await this.octokit.rest.repos.getContent({
            owner,
            repo,
            path: file
          });

          if (!Array.isArray(response.data) && response.data.type === 'file' && 'content' in response.data) {
            const content = Buffer.from(response.data.content, 'base64').toString();

            // Look for MCP-specific patterns
            if (content.includes('@modelcontextprotocol') ||
                content.includes('mcp-server') ||
                content.includes('tools/list') ||
                content.includes('resources/list')) {
              confidence += 0.6;
              indicators.push(`MCP patterns in ${file}`);
            }
          }
        } catch (error) {
          // File not found, continue
        }
      }

      // Check README for MCP references
      try {
        const readmeResponse = await this.octokit.rest.repos.getContent({
          owner,
          repo,
          path: 'README.md'
        });

        if (!Array.isArray(readmeResponse.data) && readmeResponse.data.type === 'file' && 'content' in readmeResponse.data) {
          const readmeContent = Buffer.from(readmeResponse.data.content, 'base64').toString().toLowerCase();

          if (readmeContent.includes('mcp') ||
              readmeContent.includes('model context protocol') ||
              readmeContent.includes('claude') ||
              readmeContent.includes('anthropic')) {
            confidence += 0.4;
            indicators.push('MCP references in README');
          }
        }
      } catch (error) {
        // README not found
      }

    } catch (error) {
      console.error('Error analyzing repository structure:', error);
    }

    return {
      hasManifest,
      manifestPath,
      manifestContent,
      confidence: Math.min(confidence, 1.0),
      indicators
    };
  }

  /**
   * Analyze existing manifest content
   */
  private async analyzeManifest(manifest: any): Promise<{
    inferredName?: string;
    inferredDescription?: string;
    inferredCapabilities?: string[];
    inferredCategories?: string[];
    inferredTags?: string[];
  }> {
    const analysis: any = {};

    // Extract name
    if (manifest.name) {
      analysis.inferredName = manifest.name;
    }

    // Extract description
    if (manifest.description) {
      analysis.inferredDescription = manifest.description;
    }

    // Extract capabilities from tools or capabilities array
    if (manifest.tools) {
      analysis.inferredCapabilities = manifest.tools.map((tool: any) => tool.name || tool.function?.name).filter(Boolean);
    } else if (manifest.capabilities) {
      analysis.inferredCapabilities = Array.isArray(manifest.capabilities) ? manifest.capabilities : [manifest.capabilities];
    }

    // Infer categories and tags from keywords, name, description
    const keywords = [
      ...(manifest.keywords || []),
      ...(manifest.tags || []),
      ...(manifest.categories || [])
    ];

    if (keywords.length > 0) {
      analysis.inferredTags = keywords;
      analysis.inferredCategories = this.inferCategoriesFromKeywords(keywords);
    }

    return analysis;
  }

  /**
   * AI-powered inference from repository content (placeholder for now)
   */
  private async inferMCPDetails(owner: string, repo: string, repository: GitHubRepository): Promise<{
    inferredName?: string;
    inferredDescription?: string;
    inferredCapabilities?: string[];
    inferredCategories?: string[];
    inferredTags?: string[];
  }> {
    const analysis: any = {};

    // Use repository metadata as fallback
    analysis.inferredName = repository.name.replace(/-/g, ' ').replace(/mcp/gi, 'MCP');
    analysis.inferredDescription = repository.description || `MCP server for ${repository.name}`;

    // Infer categories from repository name and description
    const text = `${repository.name} ${repository.description || ''}`.toLowerCase();
    analysis.inferredCategories = this.inferCategoriesFromText(text);
    analysis.inferredTags = this.inferTagsFromText(text);

    // TODO: Implement actual AI analysis of repository content
    // This would analyze code files, README, dependencies, etc.

    return analysis;
  }

  /**
   * Infer categories from keywords
   */
  private inferCategoriesFromKeywords(keywords: string[]): string[] {
    const categoryMap: Record<string, string[]> = {
      'weather': ['Weather', 'Forecasting'],
      'finance': ['Finance', 'Trading'],
      'crypto': ['Finance', 'Cryptocurrency'],
      'ai': ['AI', 'Machine Learning'],
      'code': ['Development', 'Code Generation'],
      'health': ['Health', 'Medical'],
      'iot': ['IoT', 'Home Automation'],
      'social': ['Social Media', 'Analytics'],
      'education': ['Education', 'Learning'],
      'data': ['Data', 'Analytics']
    };

    const categories: string[] = [];
    keywords.forEach(keyword => {
      const key = keyword.toLowerCase();
      Object.entries(categoryMap).forEach(([pattern, cats]) => {
        if (key.includes(pattern)) {
          categories.push(...cats);
        }
      });
    });

    return [...new Set(categories)];
  }

  /**
   * Infer categories from text content
   */
  private inferCategoriesFromText(text: string): string[] {
    // Simple pattern matching - could be enhanced with ML
    const patterns = {
      'Weather': ['weather', 'forecast', 'climate', 'temperature'],
      'Finance': ['finance', 'trading', 'crypto', 'currency', 'stock'],
      'Development': ['code', 'programming', 'development', 'api'],
      'AI': ['ai', 'artificial intelligence', 'machine learning', 'ml'],
      'Health': ['health', 'medical', 'fitness', 'wellness'],
      'IoT': ['iot', 'smart home', 'automation', 'devices'],
      'Data': ['data', 'analytics', 'statistics', 'metrics']
    };

    const categories: string[] = [];
    Object.entries(patterns).forEach(([category, keywords]) => {
      if (keywords.some(keyword => text.includes(keyword))) {
        categories.push(category);
      }
    });

    return categories;
  }

  /**
   * Infer tags from text content
   */
  private inferTagsFromText(text: string): string[] {
    const commonTags = [
      'weather', 'finance', 'crypto', 'ai', 'ml', 'development', 'api',
      'health', 'fitness', 'iot', 'automation', 'data', 'analytics',
      'social', 'media', 'education', 'learning', 'real-time'
    ];

    return commonTags.filter(tag => text.includes(tag));
  }

  /**
   * Batch analyze multiple repositories
   */
  async batchAnalyzeRepositories(repositories: GitHubRepository[]): Promise<MCPServerCandidate[]> {
    const candidates: MCPServerCandidate[] = [];

    for (const repo of repositories) {
      const candidate = await this.detectMCPServer(repo.owner.login, repo.name);
      if (candidate) {
        candidates.push(candidate);
      }

      // Rate limiting - GitHub API allows 5000 requests per hour
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    return candidates;
  }
}