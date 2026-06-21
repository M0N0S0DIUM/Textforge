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

const apiKeyColumns = db.prepare('PRAGMA table_info(api_keys)').all();
if (apiKeyColumns.length > 0 && !apiKeyColumns.some((column) => column.name === 'key_hash')) {
  db.exec('ALTER TABLE api_keys ADD COLUMN key_hash TEXT;');
}

// Create tables if they don't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    key_hash TEXT UNIQUE,
    customer_id TEXT,
    tier TEXT DEFAULT 'free',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS customers (
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
  );

  CREATE TABLE IF NOT EXISTS invoices (
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
  );

  CREATE TABLE IF NOT EXISTS payment_methods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stripe_customer_id TEXT NOT NULL,
    stripe_payment_method_id TEXT UNIQUE NOT NULL,
    brand TEXT,
    last4 TEXT,
    exp_month INTEGER,
    exp_year INTEGER,
    is_default INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash) WHERE key_hash IS NOT NULL;');

module.exports = db;
