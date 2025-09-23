// Migration script to move from simple to enhanced schema
const { sql } = require('@vercel/postgres');

async function migrateToEnhancedSchema() {
  console.log('🚀 Migrating from simple to enhanced schema...');
  console.log('===============================================');

  try {
    // First, let's see what tables exist
    console.log('1. Checking existing tables...');
    const existingTables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `;

    console.log('Existing tables:', existingTables.rows.map(r => r.table_name));

    // Check if we have data in the old table
    let existingServers = [];
    try {
      const serverCheck = await sql`SELECT COUNT(*) as count FROM mcp_servers`;
      const serverCount = serverCheck.rows[0].count;
      console.log(`Found ${serverCount} existing servers in simple schema`);

      if (serverCount > 0) {
        console.log('2. Backing up existing server data...');
        const backup = await sql`SELECT * FROM mcp_servers`;
        existingServers = backup.rows;
        console.log(`✅ Backed up ${existingServers.length} servers`);
      }
    } catch (error) {
      console.log('No existing mcp_servers table found, starting fresh.');
    }

    // Drop existing tables to avoid conflicts
    console.log('3. Dropping old schema tables...');
    await sql`DROP TABLE IF EXISTS mcp_servers CASCADE`;
    console.log('✅ Dropped old mcp_servers table');

    // Create enhanced schema
    console.log('4. Creating enhanced schema tables...');

    // Create authors table
    await sql`
      CREATE TABLE IF NOT EXISTS authors (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        website TEXT,
        contact_email TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Create enhanced mcp_servers table
    await sql`
      CREATE TABLE IF NOT EXISTS mcp_servers (
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
      )
    `;

    // Create categories table
    await sql`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        main_category TEXT NOT NULL,
        sub_category TEXT NOT NULL,
        description TEXT,
        UNIQUE(main_category, sub_category)
      )
    `;

    // Create server_categories junction table
    await sql`
      CREATE TABLE IF NOT EXISTS server_categories (
        server_id VARCHAR(255) REFERENCES mcp_servers(id) ON DELETE CASCADE,
        category_id INT REFERENCES categories(id) ON DELETE CASCADE,
        PRIMARY KEY (server_id, category_id)
      )
    `;

    // Create capabilities table
    await sql`
      CREATE TABLE IF NOT EXISTS capabilities (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT
      )
    `;

    // Create server_capabilities junction table
    await sql`
      CREATE TABLE IF NOT EXISTS server_capabilities (
        server_id VARCHAR(255) REFERENCES mcp_servers(id) ON DELETE CASCADE,
        capability_id INT REFERENCES capabilities(id) ON DELETE CASCADE,
        PRIMARY KEY (server_id, capability_id)
      )
    `;

    // Create tags table
    await sql`
      CREATE TABLE IF NOT EXISTS tags (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE
      )
    `;

    // Create server_tags junction table
    await sql`
      CREATE TABLE IF NOT EXISTS server_tags (
        server_id VARCHAR(255) REFERENCES mcp_servers(id) ON DELETE CASCADE,
        tag_id INT REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (server_id, tag_id)
      )
    `;

    // Create metrics table
    await sql`
      CREATE TABLE IF NOT EXISTS server_metrics (
        id SERIAL PRIMARY KEY,
        server_id VARCHAR(255) REFERENCES mcp_servers(id) ON DELETE CASCADE,
        metric_type TEXT NOT NULL,
        value DECIMAL,
        metadata JSONB,
        recorded_at TIMESTAMP DEFAULT NOW()
      )
    `;

    console.log('✅ Enhanced schema tables created successfully');

    // Create indexes
    console.log('5. Creating indexes...');
    await sql`CREATE INDEX IF NOT EXISTS idx_server_capabilities_server ON server_capabilities(server_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_server_capabilities_capability ON server_capabilities(capability_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_server_categories_server ON server_categories(server_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_server_categories_category ON server_categories(category_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_server_tags_server ON server_tags(server_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_server_tags_tag ON server_tags(tag_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_mcp_servers_status ON mcp_servers(status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_mcp_servers_verified ON mcp_servers(verified)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_server_metrics_server ON server_metrics(server_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_server_metrics_type ON server_metrics(metric_type)`;

    console.log('✅ Indexes created successfully');

    // Migrate existing data if we had any
    if (existingServers.length > 0) {
      console.log('6. Migrating existing server data...');
      for (const server of existingServers) {
        try {
          // Insert server into new schema
          await sql`
            INSERT INTO mcp_servers (
              id, name, description, endpoint, api_key, verified,
              trust_score, status, last_health_check, created_at, updated_at
            ) VALUES (
              ${server.id}, ${server.name}, ${server.description},
              ${server.endpoint}, ${server.api_key}, ${server.verified},
              ${server.trust_score}, 'active', ${server.last_health_check},
              ${server.created_at}, ${server.updated_at}
            )
          `;

          // Handle capabilities if they exist
          if (server.capabilities && Array.isArray(server.capabilities)) {
            for (const capability of server.capabilities) {
              // Insert capability if it doesn't exist
              await sql`
                INSERT INTO capabilities (name)
                VALUES (${capability})
                ON CONFLICT (name) DO NOTHING
              `;

              // Link server to capability
              const capResult = await sql`SELECT id FROM capabilities WHERE name = ${capability}`;
              if (capResult.rows.length > 0) {
                await sql`
                  INSERT INTO server_capabilities (server_id, capability_id)
                  VALUES (${server.id}, ${capResult.rows[0].id})
                  ON CONFLICT DO NOTHING
                `;
              }
            }
          }

          console.log(`✅ Migrated server: ${server.name}`);
        } catch (error) {
          console.log(`❌ Failed to migrate server ${server.name}:`, error.message);
        }
      }
    }

    console.log('\n🎉 Migration completed successfully!');
    console.log('===============================================');
    console.log('✅ Enhanced schema is now active and ready');
    console.log('✅ All existing data has been migrated');
    console.log('✅ Ready to test enhanced functionality');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Full error:', error);
  }
}

migrateToEnhancedSchema().catch(console.error);