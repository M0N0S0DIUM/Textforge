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
  },
  {
    version: 2,
    name: 'create_user_presets',
    sql: `
      CREATE TABLE IF NOT EXISTS user_presets (
        id SERIAL PRIMARY KEY,
        customer_id TEXT NOT NULL REFERENCES customers(stripe_customer_id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        actions JSONB NOT NULL,
        description TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(customer_id, name)
      );
      
      CREATE INDEX IF NOT EXISTS idx_user_presets_customer_id ON user_presets(customer_id);
    `
  },
  {
    version: 3,
    name: 'create_request_logs',
    sql: `
      CREATE TABLE IF NOT EXISTS request_logs (
        id BIGSERIAL PRIMARY KEY,
        api_key_hash TEXT NOT NULL,
        action TEXT NOT NULL,
        actions JSONB,
        status_code INTEGER NOT NULL,
        latency_ms INTEGER NOT NULL,
        request_size_bytes INTEGER,
        response_size_bytes INTEGER,
        ip_hash TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_request_logs_api_key_hash ON request_logs(api_key_hash);
      CREATE INDEX IF NOT EXISTS idx_request_logs_created_at ON request_logs(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_request_logs_action ON request_logs(action);
      
      -- Partition by month for performance (optional, can add later)
      -- CREATE INDEX IF NOT EXISTS idx_request_logs_monthly ON request_logs(date_trunc('month', created_at));
    `
  },
  {
    version: 4,
    name: 'create_daily_analytics_rollup',
    sql: `
      CREATE TABLE IF NOT EXISTS daily_analytics (
        id SERIAL PRIMARY KEY,
        api_key_hash TEXT NOT NULL,
        date DATE NOT NULL,
        total_requests INTEGER DEFAULT 0,
        total_transformations INTEGER DEFAULT 0,
        total_latency_ms BIGINT DEFAULT 0,
        total_request_bytes BIGINT DEFAULT 0,
        total_response_bytes BIGINT DEFAULT 0,
        errors INTEGER DEFAULT 0,
        action_breakdown JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(api_key_hash, date)
      );
      
      CREATE INDEX IF NOT EXISTS idx_daily_analytics_api_key_hash ON daily_analytics(api_key_hash);
      CREATE INDEX IF NOT EXISTS idx_daily_analytics_date ON daily_analytics(date DESC);
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
  pool,
  runMigrations
};