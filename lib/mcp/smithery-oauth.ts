// Service-to-service OAuth for all Smithery MCP servers
// One OAuth flow works for all Smithery MCPs

import type { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import type {
  OAuthClientInformation,
  OAuthClientMetadata,
  OAuthTokens
} from "@modelcontextprotocol/sdk/shared/auth.js";
import { oauthStore } from "@/lib/db/oauth-store";

export class SmitheryServiceOAuth implements OAuthClientProvider {
  private static _instance: SmitheryServiceOAuth;
  private _tokens?: OAuthTokens;
  private _clientInfo?: OAuthClientInformation;
  private _codeVerifier?: string;

  private constructor(
    private baseUrl: string = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000"
  ) {
    console.log('🔄 Smithery Service OAuth initialized - Base URL:', this.baseUrl);
    // Initialize OAuth store table
    oauthStore.initialize().catch(console.error);
    // Load tokens from database on initialization
    this.loadStoredTokens();
    this.loadStoredClientInfo();
  }

  // Singleton pattern - one OAuth for all Smithery servers
  static getInstance(): SmitheryServiceOAuth {
    if (!SmitheryServiceOAuth._instance) {
      SmitheryServiceOAuth._instance = new SmitheryServiceOAuth();
    }
    return SmitheryServiceOAuth._instance;
  }

  get redirectUrl(): string {
    return `${this.baseUrl}/api/oauth/smithery/callback`;
  }

  get clientMetadata(): OAuthClientMetadata {
    return {
      client_name: "MCP Store Server",
      client_uri: this.baseUrl,
      redirect_uris: [this.redirectUrl],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      scope: "read write",
      token_endpoint_auth_method: "none"
    };
  }

  async clientInformation(): Promise<OAuthClientInformation | undefined> {
    // Try memory first
    if (this._clientInfo) {
      return this._clientInfo;
    }
    // Load from database
    const stored = await oauthStore.getClientInfo('smithery');
    if (stored) {
      this._clientInfo = stored;
      return stored;
    }
    return undefined;
  }

  async saveClientInformation(info: OAuthClientInformation): Promise<void> {
    this._clientInfo = info;
    // Store in database for persistence
    await oauthStore.saveClientInfo('smithery', info);
    console.log('🔑 Saved Smithery client information to database');
  }

  async tokens(): Promise<OAuthTokens | undefined> {
    // Try memory first
    if (this._tokens) {
      return this._tokens;
    }
    // Load from database
    const stored = await oauthStore.getTokens('smithery');
    if (stored) {
      this._tokens = stored;
      return stored;
    }
    return undefined;
  }

  async saveTokens(tokens: OAuthTokens): Promise<void> {
    this._tokens = tokens;
    // Store in database for persistence
    await oauthStore.saveTokens('smithery', tokens);
    console.log('✅ Saved Smithery tokens to database - valid for ALL Smithery MCPs');
  }

  async redirectToAuthorization(url: URL): Promise<void> {
    // For service-to-service, we need to handle this programmatically
    console.log('🔄 Smithery OAuth URL:', url.toString());
    console.log('🚨 ACTION REQUIRED: Visit this URL to authenticate with Smithery:');
    console.log('🔗', url.toString());

    // TODO: In production, we could:
    // 1. Store this URL in database
    // 2. Show it in admin panel
    // 3. Use headless browser automation
    // 4. Or handle via API endpoint

    throw new Error(`Smithery OAuth required: ${url.toString()}`);
  }

  async saveCodeVerifier(verifier: string): Promise<void> {
    this._codeVerifier = verifier;
    // Store in database for persistence across requests
    await oauthStore.saveCodeVerifier('smithery', verifier);
  }

  async codeVerifier(): Promise<string> {
    // Try memory first
    if (this._codeVerifier) {
      return this._codeVerifier;
    }
    // Load from database
    const stored = await oauthStore.getCodeVerifier('smithery');
    if (stored) {
      this._codeVerifier = stored;
      return stored;
    }
    throw new Error("No code verifier stored");
  }

  // Check if we have valid tokens
  async isAuthenticated(): Promise<boolean> {
    const tokens = await this.tokens();
    return !!tokens && !!tokens.access_token;
  }

  // Load tokens from storage
  private async loadStoredTokens(): Promise<void> {
    try {
      const tokens = await oauthStore.getTokens('smithery');
      if (tokens) {
        this._tokens = tokens;
        console.log('✅ Loaded stored Smithery tokens from database');
      } else if (process.env.SMITHERY_ACCESS_TOKEN) {
        // Fallback to environment variables
        this._tokens = {
          access_token: process.env.SMITHERY_ACCESS_TOKEN,
          token_type: "Bearer",
          ...(process.env.SMITHERY_REFRESH_TOKEN && {
            refresh_token: process.env.SMITHERY_REFRESH_TOKEN
          })
        };
        console.log('✅ Loaded stored Smithery tokens from environment');
      }
    } catch (error) {
      console.error('Failed to load tokens:', error);
    }
  }

  // Load client info from storage
  private async loadStoredClientInfo(): Promise<void> {
    try {
      const clientInfo = await oauthStore.getClientInfo('smithery');
      if (clientInfo) {
        this._clientInfo = clientInfo;
        console.log('✅ Loaded stored Smithery client info from database');
      } else if (process.env.SMITHERY_CLIENT_ID) {
        // Fallback to environment variables
        this._clientInfo = {
          client_id: process.env.SMITHERY_CLIENT_ID
        };
        console.log('✅ Loaded stored Smithery client info from environment');
      }
    } catch (error) {
      console.error('Failed to load client info:', error);
    }
  }
}

// Export singleton instance
export const smitheryOAuth = SmitheryServiceOAuth.getInstance();