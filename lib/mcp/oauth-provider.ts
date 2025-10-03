// OAuth Provider for Smithery MCP servers
// Based on: https://docs.smithery.ai/use/connect

import type { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import type {
  OAuthClientInformation,
  OAuthClientMetadata,
  OAuthTokens
} from "@modelcontextprotocol/sdk/shared/auth.js";

export class SmitheryOAuthProvider implements OAuthClientProvider {
  private _tokens?: OAuthTokens;
  private _clientInfo?: OAuthClientInformation;
  private _codeVerifier?: string;

  constructor(
    private serverUrl: string,
    private clientName: string = "MCP Store Server",
    private baseUrl: string = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000"
  ) {
    console.log('🔄 OAuth Provider created for:', serverUrl, 'Base URL:', this.baseUrl);
  }

  get redirectUrl(): string {
    return `${this.baseUrl}/api/oauth/callback`;
  }

  get clientMetadata(): OAuthClientMetadata {
    return {
      client_name: this.clientName,
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
    // TODO: Persist to database/storage
    console.log('🔑 Saved client information for', this.serverUrl);
  }

  tokens(): OAuthTokens | undefined {
    return this._tokens;
  }

  async saveTokens(tokens: OAuthTokens): Promise<void> {
    this._tokens = tokens;
    // TODO: Persist to secure storage (database)
    console.log('🔑 Saved tokens for', this.serverUrl);
  }

  async redirectToAuthorization(url: URL): Promise<void> {
    // For server environments, we need to handle this differently
    // We'll store the auth URL and handle the redirect via API
    console.log('🔄 Authorization URL:', url.toString());
    // TODO: Store auth URL for user redirect
    throw new Error('Authorization redirect needed: ' + url.toString());
  }

  async saveCodeVerifier(verifier: string): Promise<void> {
    this._codeVerifier = verifier;
    // TODO: Persist temporarily for OAuth flow
  }

  async codeVerifier(): Promise<string> {
    if (!this._codeVerifier) {
      throw new Error("No code verifier stored");
    }
    return this._codeVerifier;
  }
}