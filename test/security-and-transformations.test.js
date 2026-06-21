const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.join(__dirname, '..');
const modulePaths = ['../db', '../apiKeys', '../rateLimiter'];

function clearModules() {
  for (const modulePath of modulePaths) {
    delete require.cache[require.resolve(modulePath)];
  }
}

function createTempDbPath() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'textforge-test-'));
  return {
    dir: tempDir,
    dbPath: path.join(tempDir, 'textforge.db')
  };
}

function loadApiModules(dbPath) {
  process.env.API_KEY_SECRET = 'test-api-key-secret';
  process.env.TEXTFORGE_DB_PATH = dbPath;
  delete process.env.REDIS_URL;

  clearModules();

  const db = require('../db');
  const apiKeys = require('../apiKeys');
  const rateLimiter = require('../rateLimiter');

  return { db, apiKeys, rateLimiter };
}

function cleanupLoadedDb(db, dir) {
  if (db && typeof db.close === 'function') {
    db.close();
  }
  clearModules();
  delete process.env.TEXTFORGE_DB_PATH;
  delete process.env.API_KEY_SECRET;
  delete process.env.REDIS_URL;
  fs.rmSync(dir, { recursive: true, force: true });
}

test('API key module fails fast when API_KEY_SECRET is missing', () => {
  const temp = createTempDbPath();
  const result = spawnSync(process.execPath, ['-e', "require('./rateLimiter')"], {
    cwd: repoRoot,
    env: {
      ...process.env,
      TEXTFORGE_DB_PATH: temp.dbPath,
      API_KEY_SECRET: ''
    },
    encoding: 'utf8'
  });

  fs.rmSync(temp.dir, { recursive: true, force: true });

  assert.notStrictEqual(result.status, 0);
  assert.match(`${result.stderr}${result.stdout}`, /API_KEY_SECRET/);
});

test('generateApiKey uses the tf_pro_ prefix and expected format', () => {
  const temp = createTempDbPath();
  const { db, apiKeys } = loadApiModules(temp.dbPath);

  const apiKey = apiKeys.generateApiKey();

  assert.match(apiKey, /^tf_pro_[a-f0-9]{32}$/);

  cleanupLoadedDb(db, temp.dir);
});

test('validateApiKey accepts hashed stored keys and returns the stored tier', async () => {
  const temp = createTempDbPath();
  const { db, apiKeys, rateLimiter } = loadApiModules(temp.dbPath);
  const apiKey = apiKeys.generateApiKey();
  const apiKeyHash = apiKeys.hashApiKey(apiKey);

  db.prepare('INSERT INTO api_keys (key, key_hash, customer_id, tier) VALUES (?, ?, ?, ?)').run(
    apiKey,
    apiKeyHash,
    'cus_test',
    'pro'
  );

  const validation = await rateLimiter.validateApiKey(apiKey);

  assert.deepStrictEqual(validation, {
    valid: true,
    tier: 'pro',
    keyHash: apiKeyHash
  });

  cleanupLoadedDb(db, temp.dir);
});

test('validateApiKey migrates legacy plaintext records to key_hash', async () => {
  const temp = createTempDbPath();
  const { db, apiKeys, rateLimiter } = loadApiModules(temp.dbPath);
  const apiKey = apiKeys.generateApiKey();
  const apiKeyHash = apiKeys.hashApiKey(apiKey);

  const insert = db
    .prepare('INSERT INTO api_keys (key, customer_id, tier) VALUES (?, ?, ?)')
    .run(apiKey, 'cus_legacy', 'pro');

  const validation = await rateLimiter.validateApiKey(apiKey);
  const stored = db.prepare('SELECT key_hash FROM api_keys WHERE id = ?').get(insert.lastInsertRowid);

  assert.equal(validation.valid, true);
  assert.equal(stored.key_hash, apiKeyHash);

  cleanupLoadedDb(db, temp.dir);
});

test('validateApiKey rejects tampered and malformed keys', async () => {
  const temp = createTempDbPath();
  const { db, apiKeys, rateLimiter } = loadApiModules(temp.dbPath);
  const apiKey = apiKeys.generateApiKey();
  const apiKeyHash = apiKeys.hashApiKey(apiKey);

  db.prepare('INSERT INTO api_keys (key, key_hash, customer_id, tier) VALUES (?, ?, ?, ?)').run(
    apiKey,
    apiKeyHash,
    'cus_test',
    'pro'
  );

  const tamperedLastChar = apiKey.endsWith('0') ? '1' : '0';
  const tamperedKey = `${apiKey.slice(0, -1)}${tamperedLastChar}`;

  assert.deepStrictEqual(await rateLimiter.validateApiKey(tamperedKey), {
    valid: false,
    tier: 'free'
  });
  assert.deepStrictEqual(await rateLimiter.validateApiKey('tf_invalid_key'), {
    valid: false,
    tier: 'free'
  });

  cleanupLoadedDb(db, temp.dir);
});

test('checkRateLimit uses pro limits for valid tf_pro_ keys', async () => {
  const temp = createTempDbPath();
  const { db, apiKeys, rateLimiter } = loadApiModules(temp.dbPath);
  const apiKey = apiKeys.generateApiKey();
  const apiKeyHash = apiKeys.hashApiKey(apiKey);

  db.prepare('INSERT INTO api_keys (key, key_hash, customer_id, tier) VALUES (?, ?, ?, ?)').run(
    apiKey,
    apiKeyHash,
    'cus_test',
    'pro'
  );

  await rateLimiter.resetRateLimit(apiKey);

  const first = await rateLimiter.checkRateLimit(apiKey, '127.0.0.1');
  const second = await rateLimiter.checkRateLimit(apiKey, '127.0.0.1');

  assert.equal(first.tier, 'pro');
  assert.equal(first.limit, rateLimiter.PRO_TIER_LIMIT);
  assert.equal(first.remaining, rateLimiter.PRO_TIER_LIMIT - 1);
  assert.equal(second.remaining, rateLimiter.PRO_TIER_LIMIT - 2);

  cleanupLoadedDb(db, temp.dir);
});

test('random transformation preserves requested length and charset', () => {
  const { random } = require('../transformations');

  const alnum = random(24, 'alnum');
  const hex = random(40, 'hex');

  assert.equal(alnum.length, 24);
  assert.match(alnum, /^[a-zA-Z0-9]+$/);
  assert.equal(hex.length, 40);
  assert.match(hex, /^[a-f0-9]+$/);
});

test('representative transformations remain stable', () => {
  const { slugify, palindromecheck, morse } = require('../transformations');

  assert.equal(slugify('Hello, World! Again'), 'hello-world-again');
  assert.deepStrictEqual(palindromecheck('Never odd or even'), {
    palindrome: true,
    normalized: 'neveroddoreven'
  });
  assert.equal(morse('SOS'), '... --- ...');
});
