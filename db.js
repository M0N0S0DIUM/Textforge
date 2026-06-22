const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.TEXTFORGE_DB_PATH
  ? path.resolve(process.env.TEXTFORGE_DB_PATH)
  : path.join(__dirname, 'data', 'textforge.db');

// Ensure data directory exists
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// ============================================
// Schema Migrations
// ============================================

// Bootstrap the migrations tracking table first so that subsequent
// migrations can use it immediately.
db.exec(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version   INTEGER PRIMARY KEY,
    name      TEXT NOT NULL,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

/**
 * Ordered list of idempotent schema migrations.
 * Each entry has a unique integer version, a human-readable name, and an
 * array of SQL statements to execute inside a single transaction.
 * Add new migrations at the end – never modify existing entries.
 */
const MIGRATIONS = [
  {
    version: 1,
    name: 'create_core_tables',
    sql: [
      `CREATE TABLE IF NOT EXISTS api_keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        key_hash TEXT UNIQUE,
        customer_id TEXT,
        tier TEXT DEFAULT 'free',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stripe_customer_id TEXT UNIQUE NOT NULL,
        email TEXT,
        tier TEXT DEFAULT 'free',
        subscription_id TEXT,
        subscription_status TEXT DEFAULT 'inactive',
        current_period_end DATETIME,
        cancel_at_period_end INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stripe_invoice_id TEXT UNIQUE NOT NULL,
        stripe_customer_id TEXT NOT NULL,
        amount_paid INTEGER DEFAULT 0,
        amount_due INTEGER DEFAULT 0,
        currency TEXT DEFAULT 'usd',
        status TEXT DEFAULT 'draft',
        invoice_pdf TEXT,
        hosted_invoice_url TEXT,
        period_start DATETIME,
        period_end DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS payment_methods (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stripe_customer_id TEXT NOT NULL,
        stripe_payment_method_id TEXT UNIQUE NOT NULL,
        brand TEXT,
        last4 TEXT,
        exp_month INTEGER,
        exp_year INTEGER,
        is_default INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash) WHERE key_hash IS NOT NULL`
    ]
  },
  {
    version: 2,
    name: 'add_api_keys_key_hash_column',
    sql: [
      // SQLite has no IF NOT EXISTS for ADD COLUMN; guard via the
      // migrations table – this migration only runs once.
      `ALTER TABLE api_keys ADD COLUMN key_hash TEXT`
    ],
    // Some databases created with migration 1 already include key_hash in
    // the CREATE TABLE statement, so silently ignore "duplicate column" errors.
    ignoreErrors: [/duplicate column/i, /already exists/i]
  }
];

/**
 * Run all pending migrations in version order inside individual transactions.
 * Each migration is recorded in schema_migrations so it is never re-applied.
 */
function runMigrations() {
  const applied = new Set(
    db.prepare('SELECT version FROM schema_migrations').all().map(r => r.version)
  );

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.version)) {
      continue;
    }

    db.transaction(() => {
      for (const statement of migration.sql) {
        try {
          db.exec(statement);
        } catch (err) {
          const ignored = (migration.ignoreErrors || []).some(pattern => pattern.test(err.message));
          if (!ignored) throw err;
        }
      }
      db.prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)').run(
        migration.version,
        migration.name
      );
    })();
  }
}

runMigrations();

module.exports = db;
