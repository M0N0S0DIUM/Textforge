/**
 * Integration tests for GET /transform and POST /transform
 *
 * Verifies:
 * - GET / POST parity (same inputs produce identical responses)
 * - Validation behaviour (missing text, missing action, invalid action)
 * - Single transformation
 * - Chaining (actions array / comma-separated)
 * - Preview mode
 * - Preset transformations
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

// ---------------------------------------------------------------------------
// Test server setup
// ---------------------------------------------------------------------------

let server;
let baseUrl;

function request(method, pathname, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathname, baseUrl);
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          reject(new Error(`JSON parse error: ${data}`));
        }
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function get(pathname) {
  return request('GET', pathname, null);
}

function post(pathname, body) {
  return request('POST', pathname, body);
}

// ---------------------------------------------------------------------------
// Lifecycle hooks (node:test does not have beforeAll, use test ordering)
// ---------------------------------------------------------------------------

let tempDir;

test('setup: start test server', async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'textforge-integration-'));
  const dbPath = path.join(tempDir, 'test.db');

  process.env.TEXTFORGE_DB_PATH = dbPath;
  process.env.API_KEY_SECRET = 'integration-test-secret';
  delete process.env.REDIS_URL;
  // Use port 0 so the OS assigns a random free port
  process.env.PORT = '0';

  // Load the app module and start the server (does NOT auto-start since require.main !== module)
  const { startServer } = require('../app');
  server = await startServer();
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

test('GET /transform: missing text → 400', async () => {
  const { status, body } = await get('/transform?action=slugify');
  assert.equal(status, 400);
  assert.equal(body.success, false);
  assert.match(body.error, /text/i);
});

test('POST /transform: missing text → 400', async () => {
  const { status, body } = await post('/transform', { action: 'slugify' });
  assert.equal(status, 400);
  assert.equal(body.success, false);
  assert.match(body.error, /text/i);
});

test('GET /transform: missing action → 400', async () => {
  const { status, body } = await get('/transform?text=hello');
  assert.equal(status, 400);
  assert.equal(body.success, false);
  assert.match(body.error, /action/i);
});

test('POST /transform: missing action → 400', async () => {
  const { status, body } = await post('/transform', { text: 'hello' });
  assert.equal(status, 400);
  assert.equal(body.success, false);
  assert.match(body.error, /action/i);
});

test('GET /transform: invalid action → 400', async () => {
  const { status, body } = await get('/transform?text=hello&action=doesnotexist');
  assert.equal(status, 400);
  assert.equal(body.success, false);
  assert.match(body.error, /invalid action/i);
});

test('POST /transform: invalid action → 400', async () => {
  const { status, body } = await post('/transform', { text: 'hello', action: 'doesnotexist' });
  assert.equal(status, 400);
  assert.equal(body.success, false);
  assert.match(body.error, /invalid action/i);
});

// ---------------------------------------------------------------------------
// Single transformation – GET / POST parity
// ---------------------------------------------------------------------------

test('GET and POST /transform: slugify returns identical result', async () => {
  const text = 'Hello, World!';
  const [getRes, postRes] = await Promise.all([
    get(`/transform?text=${encodeURIComponent(text)}&action=slugify`),
    post('/transform', { text, action: 'slugify' })
  ]);

  assert.equal(getRes.status, 200);
  assert.equal(postRes.status, 200);
  assert.equal(getRes.body.result, postRes.body.result);
  assert.equal(getRes.body.result, 'hello-world');
});

test('GET and POST /transform: reverse on non-empty text', async () => {
  // Note: the API requires non-empty text (?text= empty string fails the !text guard)
  const text = 'hello';
  const [getRes, postRes] = await Promise.all([
    get(`/transform?text=${encodeURIComponent(text)}&action=reverse`),
    post('/transform', { text, action: 'reverse' })
  ]);

  assert.equal(getRes.status, 200);
  assert.equal(postRes.status, 200);
  assert.equal(getRes.body.result, 'olleh');
  assert.equal(getRes.body.result, postRes.body.result);
});

test('GET and POST /transform: hash produces 64-char hex string', async () => {
  const text = 'test input';
  const [getRes, postRes] = await Promise.all([
    get(`/transform?text=${encodeURIComponent(text)}&action=hash`),
    post('/transform', { text, action: 'hash' })
  ]);

  assert.equal(getRes.status, 200);
  assert.match(getRes.body.result, /^[a-f0-9]{64}$/);
  assert.equal(getRes.body.result, postRes.body.result);
});

test('GET and POST /transform: countwords returns object result', async () => {
  const text = 'Hello world. How are you?';
  const [getRes, postRes] = await Promise.all([
    get(`/transform?text=${encodeURIComponent(text)}&action=countwords`),
    post('/transform', { text, action: 'countwords' })
  ]);

  assert.equal(getRes.status, 200);
  assert.equal(typeof getRes.body.result, 'object');
  assert.equal(getRes.body.result.words, postRes.body.result.words);
  assert.equal(getRes.body.result.sentences, postRes.body.result.sentences);
});

// ---------------------------------------------------------------------------
// Chaining
// ---------------------------------------------------------------------------

test('GET /transform: chaining via comma-separated actions string', async () => {
  const text = 'Hello World';
  const { status, body } = await get(
    `/transform?text=${encodeURIComponent(text)}&actions=slugify,reverse`
  );

  assert.equal(status, 200);
  assert.ok(Array.isArray(body.actions));
  assert.deepStrictEqual(body.actions, ['slugify', 'reverse']);
  // slugify → 'hello-world', reverse → 'dlrow-olleh'
  assert.equal(body.result, 'dlrow-olleh');
});

test('POST /transform: chaining via array of actions', async () => {
  const text = 'Hello World';
  const { status, body } = await post('/transform', {
    text,
    actions: ['slugify', 'reverse']
  });

  assert.equal(status, 200);
  assert.deepStrictEqual(body.actions, ['slugify', 'reverse']);
  assert.equal(body.result, 'dlrow-olleh');
});

test('GET and POST /transform: chaining produces the same result', async () => {
  const text = 'Hello World!';
  const [getRes, postRes] = await Promise.all([
    get(`/transform?text=${encodeURIComponent(text)}&actions=slugify,reverse`),
    post('/transform', { text, actions: ['slugify', 'reverse'] })
  ]);

  assert.equal(getRes.body.result, postRes.body.result);
});

// ---------------------------------------------------------------------------
// Preview mode
// ---------------------------------------------------------------------------

test('GET /transform: preview=true returns transformations object', async () => {
  const text = 'Hello World';
  const { status, body } = await get(
    `/transform?text=${encodeURIComponent(text)}&preview=true`
  );

  assert.equal(status, 200);
  assert.equal(body.success, true);
  assert.equal(typeof body.transformations, 'object');
  assert.ok('slugify' in body.transformations);
  assert.ok('reverse' in body.transformations);
});

test('POST /transform: preview=true returns transformations object', async () => {
  const text = 'Hello World';
  const { status, body } = await post('/transform', { text, preview: true });

  assert.equal(status, 200);
  assert.equal(typeof body.transformations, 'object');
  assert.ok('slugify' in body.transformations);
});

test('GET and POST /transform: preview results are consistent', async () => {
  const text = 'parity check';
  const [getRes, postRes] = await Promise.all([
    get(`/transform?text=${encodeURIComponent(text)}&preview=true`),
    post('/transform', { text, preview: true })
  ]);

  assert.equal(getRes.body.transformations.slugify, postRes.body.transformations.slugify);
  assert.equal(getRes.body.transformations.reverse, postRes.body.transformations.reverse);
});

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

test('GET /transform: preset=url applies url preset', async () => {
  const text = 'Hello World!';
  const { status, body } = await get(
    `/transform?text=${encodeURIComponent(text)}&preset=url`
  );

  assert.equal(status, 200);
  assert.equal(body.success, true);
  assert.equal(body.preset, 'url');
});

test('POST /transform: preset=url applies url preset and matches GET result', async () => {
  const text = 'Hello World!';
  const [getRes, postRes] = await Promise.all([
    get(`/transform?text=${encodeURIComponent(text)}&preset=url`),
    post('/transform', { text, preset: 'url' })
  ]);

  assert.equal(getRes.status, 200);
  assert.deepStrictEqual(getRes.body.result, postRes.body.result);
});

// ---------------------------------------------------------------------------
// Special characters & edge cases
// ---------------------------------------------------------------------------

test('GET /transform: special characters in text are handled correctly', async () => {
  const text = '!@#$%^&*()';
  const { status, body } = await get(
    `/transform?text=${encodeURIComponent(text)}&action=removespecial`
  );

  assert.equal(status, 200);
  assert.equal(body.result, '');
});

test('POST /transform: special characters in text are handled correctly', async () => {
  const text = '!@#$%^&*()';
  const { status, body } = await post('/transform', { text, action: 'removespecial' });

  assert.equal(status, 200);
  assert.equal(body.result, '');
});

// ---------------------------------------------------------------------------
// Teardown
// ---------------------------------------------------------------------------

test('teardown: close test server', async () => {
  await new Promise((resolve, reject) => {
    server.close(err => (err ? reject(err) : resolve()));
  });
  fs.rmSync(tempDir, { recursive: true, force: true });
  delete process.env.TEXTFORGE_DB_PATH;
  delete process.env.API_KEY_SECRET;
  delete process.env.PORT;
});
