import { Pool } from 'pg';
import type { OAuthTokens, OAuthClientInformation } from '@modelcontextprotocol/sdk/shared/auth.js';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export interface StoredOAuthData {
  service_name: string;
  client_id?: string;
  client_secret?: string;
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_at?: Date;
  scope?: string;
  code_verifier?: string;
}

export class OAuthStore {
  private static instance: OAuthStore;

  private constructor() {}

  static getInstance(): OAuthStore {
    if (!OAuthStore.instance) {
      OAuthStore.instance = new OAuthStore();
    }
    return OAuthStore.instance;
  }

  async initialize(): Promise<void> {
    const client = await pool.connect();
    try {
      // Create table if it doesn't exist
      await client.query(`
        CREATE TABLE IF NOT EXISTS oauth_tokens (
          id SERIAL PRIMARY KEY,
          service_name VARCHAR(255) NOT NULL UNIQUE,
          client_id TEXT,
          client_secret TEXT,
          access_token TEXT,
          refresh_token TEXT,
          token_type VARCHAR(50),
          expires_at TIMESTAMP,
          scope TEXT,
          code_verifier TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_oauth_service ON oauth_tokens(service_name)
      `);

      console.log('✅ OAuth tokens table initialized');
    } finally {
      client.release();
    }
  }

  async saveTokens(serviceName: string, tokens: OAuthTokens): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query(
        `INSERT INTO oauth_tokens (service_name, access_token, refresh_token, token_type, scope, updated_at)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
         ON CONFLICT (service_name)
         DO UPDATE SET
           access_token = $2,
           refresh_token = $3,
           token_type = $4,
           scope = $5,
           updated_at = CURRENT_TIMESTAMP`,
        [
          serviceName,
          tokens.access_token,
          tokens.refresh_token,
          tokens.token_type,
          tokens.scope
        ]
      );
      console.log(`✅ Saved OAuth tokens for ${serviceName} to database`);
    } finally {
      client.release();
    }
  }

  async getTokens(serviceName: string): Promise<OAuthTokens | null> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT access_token, refresh_token, token_type, scope FROM oauth_tokens WHERE service_name = $1',
        [serviceName]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        access_token: row.access_token,
        refresh_token: row.refresh_token,
        token_type: row.token_type,
        scope: row.scope
      };
    } finally {
      client.release();
    }
  }

  async saveClientInfo(serviceName: string, clientInfo: OAuthClientInformation): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query(
        `INSERT INTO oauth_tokens (service_name, client_id, client_secret, updated_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
         ON CONFLICT (service_name)
         DO UPDATE SET
           client_id = $2,
           client_secret = $3,
           updated_at = CURRENT_TIMESTAMP`,
        [
          serviceName,
          clientInfo.client_id,
          clientInfo.client_secret
        ]
      );
      console.log(`✅ Saved OAuth client info for ${serviceName} to database`);
    } finally {
      client.release();
    }
  }

  async getClientInfo(serviceName: string): Promise<OAuthClientInformation | null> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT client_id, client_secret FROM oauth_tokens WHERE service_name = $1',
        [serviceName]
      );

      if (result.rows.length === 0 || !result.rows[0].client_id) {
        return null;
      }

      const row = result.rows[0];
      return {
        client_id: row.client_id,
        client_secret: row.client_secret
      };
    } finally {
      client.release();
    }
  }

  async saveCodeVerifier(serviceName: string, codeVerifier: string): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query(
        `INSERT INTO oauth_tokens (service_name, code_verifier, updated_at)
         VALUES ($1, $2, CURRENT_TIMESTAMP)
         ON CONFLICT (service_name)
         DO UPDATE SET
           code_verifier = $2,
           updated_at = CURRENT_TIMESTAMP`,
        [serviceName, codeVerifier]
      );
      console.log(`✅ Saved code verifier for ${serviceName} to database`);
    } finally {
      client.release();
    }
  }

  async getCodeVerifier(serviceName: string): Promise<string | null> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT code_verifier FROM oauth_tokens WHERE service_name = $1',
        [serviceName]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0].code_verifier;
    } finally {
      client.release();
    }
  }

  async clearCodeVerifier(serviceName: string): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query(
        `UPDATE oauth_tokens SET code_verifier = NULL WHERE service_name = $1`,
        [serviceName]
      );
    } finally {
      client.release();
    }
  }
}

export const oauthStore = OAuthStore.getInstance();