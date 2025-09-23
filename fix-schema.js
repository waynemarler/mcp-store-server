// Quick fix to add enhanced schema columns to existing table
const { sql } = require('@vercel/postgres');

async function addEnhancedColumns() {
  console.log('🔧 Adding enhanced schema columns to existing table...');

  try {
    // Add missing columns one by one
    const columns = [
      'ALTER TABLE mcp_servers ADD COLUMN IF NOT EXISTS logo_url VARCHAR(255)',
      'ALTER TABLE mcp_servers ADD COLUMN IF NOT EXISTS type VARCHAR(50)',
      'ALTER TABLE mcp_servers ADD COLUMN IF NOT EXISTS version VARCHAR(50)',
      'ALTER TABLE mcp_servers ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT \'active\'',
      'ALTER TABLE mcp_servers ADD COLUMN IF NOT EXISTS tags JSONB',
      'ALTER TABLE mcp_servers ADD COLUMN IF NOT EXISTS author_id VARCHAR(255)',
      'ALTER TABLE mcp_servers ADD COLUMN IF NOT EXISTS author_name VARCHAR(255)',
      'ALTER TABLE mcp_servers ADD COLUMN IF NOT EXISTS author_website VARCHAR(255)',
      'ALTER TABLE mcp_servers ADD COLUMN IF NOT EXISTS author_email VARCHAR(255)'
    ];

    for (const column of columns) {
      console.log(`Adding: ${column}`);
      await sql.query(column);
    }

    console.log('✅ Enhanced columns added successfully!');
    console.log('🚀 Enhanced schema is now ready for testing.');

  } catch (error) {
    console.error('❌ Error adding columns:', error.message);
  }
}

addEnhancedColumns().catch(console.error);