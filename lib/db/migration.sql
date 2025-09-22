-- Drop existing tables if they exist
DROP TABLE IF EXISTS server_metrics CASCADE;
DROP TABLE IF EXISTS server_capabilities CASCADE;
DROP TABLE IF EXISTS server_tags CASCADE;
DROP TABLE IF EXISTS server_categories CASCADE;
DROP TABLE IF EXISTS capabilities CASCADE;
DROP TABLE IF EXISTS tags CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS mcp_servers CASCADE;
DROP TABLE IF EXISTS authors CASCADE;

-- 1. Authors Table
CREATE TABLE authors (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  website TEXT,
  contact_email TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 2. MCP Servers Table (enhanced)
CREATE TABLE mcp_servers (
  id VARCHAR(255) PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  endpoint TEXT NOT NULL,
  api_key VARCHAR(255),
  type TEXT CHECK (type IN ('informational', 'transactional', 'task')),
  version TEXT,
  author_id INT REFERENCES authors(id),
  verified BOOLEAN DEFAULT FALSE,
  trust_score INT DEFAULT 50 CHECK (trust_score >= 0 AND trust_score <= 100),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'deprecated')),
  last_health_check TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. Categories Table (hierarchical)
CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  main_category TEXT NOT NULL,
  sub_category TEXT NOT NULL,
  description TEXT,
  UNIQUE(main_category, sub_category)
);

-- 4. Server-Categories Join Table
CREATE TABLE server_categories (
  server_id VARCHAR(255) REFERENCES mcp_servers(id) ON DELETE CASCADE,
  category_id INT REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (server_id, category_id)
);

-- 5. Tags Table
CREATE TABLE tags (
  id SERIAL PRIMARY KEY,
  tag_name TEXT UNIQUE NOT NULL
);

-- 6. Server-Tags Join Table
CREATE TABLE server_tags (
  server_id VARCHAR(255) REFERENCES mcp_servers(id) ON DELETE CASCADE,
  tag_id INT REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (server_id, tag_id)
);

-- 7. Capabilities Table
CREATE TABLE capabilities (
  id SERIAL PRIMARY KEY,
  capability_name TEXT UNIQUE NOT NULL,
  description TEXT
);

-- 8. Server-Capabilities Join Table
CREATE TABLE server_capabilities (
  server_id VARCHAR(255) REFERENCES mcp_servers(id) ON DELETE CASCADE,
  capability_id INT REFERENCES capabilities(id) ON DELETE CASCADE,
  PRIMARY KEY (server_id, capability_id)
);

-- 9. Metrics Table (for tracking usage and performance)
CREATE TABLE server_metrics (
  id SERIAL PRIMARY KEY,
  server_id VARCHAR(255) REFERENCES mcp_servers(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL CHECK (metric_type IN ('request', 'error', 'latency')),
  value NUMERIC,
  metadata JSONB,
  recorded_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_mcp_servers_author ON mcp_servers(author_id);
CREATE INDEX idx_mcp_servers_verified ON mcp_servers(verified);
CREATE INDEX idx_mcp_servers_status ON mcp_servers(status);
CREATE INDEX idx_mcp_servers_trust_score ON mcp_servers(trust_score DESC);
CREATE INDEX idx_categories_main ON categories(main_category);
CREATE INDEX idx_tags_name ON tags(tag_name);
CREATE INDEX idx_capabilities_name ON capabilities(capability_name);
CREATE INDEX idx_metrics_server_time ON server_metrics(server_id, recorded_at DESC);
CREATE INDEX idx_metrics_type ON server_metrics(metric_type);

-- Insert some default categories
INSERT INTO categories (main_category, sub_category, description) VALUES
('Information', 'Weather', 'Weather data and forecasting services'),
('Information', 'News', 'News aggregation and feeds'),
('Information', 'Financial', 'Financial data and market information'),
('Tools', 'Development', 'Software development tools'),
('Tools', 'Productivity', 'Productivity and workflow tools'),
('Tools', 'Analytics', 'Data analytics and visualization'),
('Communication', 'Email', 'Email services and management'),
('Communication', 'Chat', 'Chat and messaging services'),
('Communication', 'Social', 'Social media integration'),
('Data', 'Database', 'Database operations and queries'),
('Data', 'Storage', 'File and object storage services'),
('Data', 'Processing', 'Data processing and transformation');

-- Insert some common capabilities
INSERT INTO capabilities (capability_name, description) VALUES
('weather.current', 'Get current weather conditions'),
('weather.forecast', 'Get weather forecast'),
('weather.alerts', 'Get weather alerts and warnings'),
('data.query', 'Query data sources'),
('data.insert', 'Insert data into storage'),
('data.update', 'Update existing data'),
('data.delete', 'Delete data'),
('file.read', 'Read file contents'),
('file.write', 'Write to files'),
('api.call', 'Make external API calls'),
('compute.execute', 'Execute computational tasks'),
('translate.text', 'Translate text between languages'),
('search.web', 'Search the web'),
('search.documents', 'Search documents and files');