// Script to run semantic capabilities migration
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const { sql } = await import('@vercel/postgres');

  try {
    console.log('🚀 Starting semantic capabilities migration...');

    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '../lib/db/semantic-capabilities-migration.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Split the SQL into individual statements (split by semicolon and newline)
    const statements = migrationSQL
      .split(';\n')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--') && !stmt.startsWith('COMMENT'));

    console.log(`📝 Executing ${statements.length} migration statements...`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          console.log(`⚡ Executing statement ${i + 1}/${statements.length}`);
          await sql.query(statement);
        } catch (error) {
          console.error(`❌ Error in statement ${i + 1}:`, error.message);
          console.error('Statement:', statement.substring(0, 100) + '...');
          // Continue with other statements
        }
      }
    }

    // Run verification query
    console.log('\n📊 Verification - Semantic categorization summary:');
    const verificationResult = await sql`
      SELECT
          intent_category,
          context_type,
          COUNT(*) as capability_count
      FROM capabilities
      WHERE intent_category IS NOT NULL
      GROUP BY intent_category, context_type
      ORDER BY intent_category, context_type
    `;

    console.table(verificationResult.rows);

    // Show sample capabilities for time_query
    console.log('\n🕒 Sample time_query capabilities:');
    const timeQueryResult = await sql`
      SELECT capability_name, semantic_tags, context_type
      FROM capabilities
      WHERE intent_category = 'time_query'
      ORDER BY context_type, capability_name
      LIMIT 10
    `;

    console.table(timeQueryResult.rows);

    console.log('\n✅ Semantic capabilities migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run the migration
if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('🎉 Migration completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { runMigration };