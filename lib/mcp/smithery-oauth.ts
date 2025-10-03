// Service-to-service OAuth for all Smithery MCP servers
// One OAuth flow works for all Smithery MCPs

import type { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import type {
  OAuthClientInformation,
  OAuthClientMetadata,
  OAuthTokens
} from "@modelcontextprotocol/sdk/shared/auth.js";

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

  clientInformation(): OAuthClientInformation | undefined {
    return this._clientInfo;
  }

  async saveClientInformation(info: OAuthClientInformation): Promise<void> {
    this._clientInfo = info;
    // TODO: Store in database for persistence
    console.log('🔑 Saved Smithery client information');
  }

  tokens(): OAuthTokens | undefined {
    return this._tokens;
  }

  async saveTokens(tokens: OAuthTokens): Promise<void> {
    this._tokens = tokens;
    // TODO: Store in environment variables or secure database
    console.log('✅ Saved Smithery tokens - valid for ALL Smithery MCPs');
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
  }

  async codeVerifier(): Promise<string> {
    if (!this._codeVerifier) {
      throw new Error("No code verifier stored");
    }
    return this._codeVerifier;
  }

  // Check if we have valid tokens
  isAuthenticated(): boolean {
    return !!this._tokens && !!this._tokens.access_token;
  }

  // Load tokens from storage (environment variables for now)
  private loadStoredTokens(): void {
    if (process.env.SMITHERY_ACCESS_TOKEN) {
      this._tokens = {
        access_token: process.env.SMITHERY_ACCESS_TOKEN,
        token_type: "Bearer",
        // Add other token fields if available
        ...(process.env.SMITHERY_REFRESH_TOKEN && {
          refresh_token: process.env.SMITHERY_REFRESH_TOKEN
        })
      };
      console.log('✅ Loaded stored Smithery tokens from environment');
    }
  }

  // Load client info from storage
  private loadStoredClientInfo(): void {
    // For now, we'll use a hardcoded approach
    // In production, this should come from database or environment
    if (process.env.SMITHERY_CLIENT_ID) {
      this._clientInfo = {
        client_id: process.env.SMITHERY_CLIENT_ID
      };
      console.log('✅ Loaded stored Smithery client info from environment');
    }
  }
}

// Export singleton instance
export const smitheryOAuth = SmitheryServiceOAuth.getInstance();