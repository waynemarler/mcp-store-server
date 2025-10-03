-- OAuth tokens storage for Smithery service-to-service auth
CREATE TABLE IF NOT EXISTS oauth_tokens (
  id SERIAL PRIMARY KEY,
  service_name VARCHAR(255) NOT NULL UNIQUE, -- 'smithery' for all Smithery MCPs
  client_id TEXT,
  client_secret TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_type VARCHAR(50),
  expires_at TIMESTAMP,
  scope TEXT,
  code_verifier TEXT, -- Temporary storage for PKCE
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_oauth_service ON oauth_tokens(service_name);