const { Pool } = require('pg');

// Get database URL from environment (Railway uses DATABASE_URL)
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required for PostgreSQL');
}

// Create connection pool
const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 10, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// ============================================
// Schema Migrations
// ============================================

/**
 * Ordered list of idempotent schema migrations.
 * Each entry has a unique integer version, a human-readable name, and an
 * array of SQL statements to execute inside a single transaction.
 */
const MIGRATIONS = [
  {
    version: 1,
    name: 'create_core_tables',
    sql: `
      CREATE TABLE IF NOT EXISTS api_keys (
        id SERIAL PRIMARY KEY,
        key TEXT UNIQUE NOT NULL,
        key_hash TEXT UNIQUE,
        customer_id TEXT,
        tier TEXT DEFAULT 'free',
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        stripe_customer_id TEXT UNIQUE NOT NULL,
        email TEXT,
        tier TEXT DEFAULT 'free',
        subscription_id TEXT,
        subscription_status TEXT DEFAULT 'inactive',
        current_period_end TIMESTAMPTZ,
        cancel_at_period_end BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS invoices (
        id SERIAL PRIMARY KEY,
        stripe_invoice_id TEXT UNIQUE NOT NULL,
        stripe_customer_id TEXT NOT NULL,
        amount_paid INTEGER DEFAULT 0,
        amount_due INTEGER DEFAULT 0,
        currency TEXT DEFAULT 'usd',
        status TEXT DEFAULT 'draft',
        invoice_pdf TEXT,
        hosted_invoice_url TEXT,
        period_start TIMESTAMPTZ,
        period_end TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS payment_methods (
        id SERIAL PRIMARY KEY,
        stripe_customer_id TEXT NOT NULL,
        stripe_payment_method_id TEXT UNIQUE NOT NULL,
        brand TEXT,
        last4 TEXT,
        exp_month INTEGER,
        exp_year INTEGER,
        is_default BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `
  }
];

/**
 * Run all pending migrations in version order inside individual transactions.
 */
async function runMigrations() {
  const client = await pool.connect();
  
  try {
    // Check which migrations have been applied
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    const result = await client.query('SELECT version FROM schema_migrations');
    const appliedVersions = new Set(result.rows.map(row => row.version));
    
    // Apply pending migrations
    for (const migration of MIGRATIONS) {
      if (!appliedVersions.has(migration.version)) {
        console.log(`Applying migration: ${migration.name}`);
        
        await client.query('BEGIN');
        try {
          // Split SQL statements and execute each one
          const statements = migration.sql
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0);
          
          for (const statement of statements) {
            await client.query(statement);
          }
          
          // Record the migration
          await client.query(
            'INSERT INTO schema_migrations (version, name) VALUES ($1, $2)',
            [migration.version, migration.name]
          );
          
          await client.query('COMMIT');
          console.log(`Migration ${migration.name} applied successfully`);
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        }
      }
    }
  } finally {
    client.release();
  }
}

/**
 * Execute a query with retry logic for connection failures
 * @param {string} text - SQL query text
 * @param {Array} values - Query parameters
 * @returns {Promise<object>} Query result
 */
async function query(text, values = []) {
  try {
    const result = await pool.query(text, values);
    return result;
  } catch (err) {
    console.error('Database query error:', err.message);
    
    // Check if connection is invalid and recreate pool
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      console.log('Recreating database connection pool...');
      pool.end();
      pool.connect(); // Will recreate the pool on next use
    }
    
    throw err;
  }
}

/**
 * Get a single row from the database
 * @param {string} text - SQL query text
 * @param {Array} values - Query parameters
 * @returns {Promise<object|null>} Single row or null
 */
async function get(text, values = []) {
  const result = await query(text, values);
  return result.rows[0] || null;
}

/**
 * Prepare a statement for execution (for compatibility with existing code)
 * Converts SQLite-style ? placeholders to PostgreSQL $1, $2, etc.
 * @param {string} text - SQL query text
 * @returns {object} Statement object with get and run methods
 */
function prepare(text) {
  // Convert ? placeholders to PostgreSQL $1, $2, etc.
  let paramIndex = 0;
  const convertedText = text.replace(/\?/g, () => {
    paramIndex++;
    return '$' + paramIndex;
  });
  
  return {
    async get(values = []) {
      const result = await query(convertedText, values);
      return result.rows[0] || null;
    },
    
    async run(values = []) {
      const result = await query(convertedText, values);
      return { rowsAffected: result.rowCount, lastInsertRowid: result.rows[0]?.id };
    }
  };
}

/**
 * Initialize the database connection
 * @returns {Promise<void>}
 */
async function init() {
  try {
    // Test connection
    await pool.query('SELECT 1');
    console.log('Database connection established');
  } catch (err) {
    console.error('Failed to connect to database:', err.message);
    throw err;
  }
}

/**
 * Close all connections in the pool
 * @returns {Promise<void>}
 */
async function close() {
  await pool.end();
  console.log('Database connection pool closed');
}

// Initialize migrations on module load if in standalone mode
if (require.main === module) {
  runMigrations()
    .then(() => init())
    .catch(err => {
      console.error('Failed to initialize database:', err);
      process.exit(1);
    });
}

module.exports = {
  query,
  get,
  prepare,
  init,
  close,
  pool
};