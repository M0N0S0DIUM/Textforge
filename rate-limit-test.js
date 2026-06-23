#!/usr/bin/env node
/**
 * TextForge Rate Limit Test Script
 * 
 * Usage:
 *   node rate-limit-test.js                    # Test free tier (no API key)
 *   node rate-limit-test.js --pro <api_key>    # Test pro tier with API key
 *   node rate-limit-test.js --help             # Show help
 */

const https = require('https');
const http = require('http');

const BASE_URL = process.env.BASE_URL || 'https://textforge.co';
const ENDPOINT = '/transform?text=Hello%20World!&action=slugify';

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    apiKey: null,
    requests: 100,
    concurrency: 10,
    delay: 0,
    verbose: false
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--pro':
      case '-p':
        options.apiKey = args[++i];
        break;
      case '--requests':
      case '-n':
        options.requests = parseInt(args[++i], 10);
        break;
      case '--concurrency':
      case '-c':
        options.concurrency = parseInt(args[++i], 10);
        break;
      case '--delay':
      case '-d':
        options.delay = parseInt(args[++i], 10);
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--help':
      case '-h':
        showHelp();
        process.exit(0);
      default:
        if (args[i].startsWith('--')) {
          console.error(`Unknown option: ${args[i]}`);
          showHelp();
          process.exit(1);
        }
    }
  }
  return options;
}

function showHelp() {
  console.log(`
TextForge Rate Limit Test Script

Usage:
  node rate-limit-test.js [options]

Options:
  --pro, -p <key>       Pro API key (tf_pro_...) to test Pro tier (50,000/day)
  --requests, -n <num>  Number of requests to make (default: 100)
  --concurrency, -c <num> Concurrent requests (default: 10)
  --delay, -d <ms>      Delay between request batches (default: 0)
  --verbose, -v         Verbose output
  --help, -h            Show this help

Examples:
  # Test free tier (1,000/day limit)
  node rate-limit-test.js -n 50

  # Test pro tier with API key
  node rate-limit-test.js --pro tf_pro_abc123... -n 200

  # Stress test with concurrency
  node rate-limit-test.js -n 1000 -c 50 -d 100
`);
}

function makeRequest(url, apiKey) {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    const options = {
      method: 'GET',
      headers: {
        'User-Agent': 'TextForge-RateLimit-Test/1.0'
      }
    };

    if (apiKey) {
      options.headers['X-API-Key'] = apiKey;
    }

    const start = Date.now();
    const req = client.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const latency = Date.now() - start;
        try {
          const parsed = JSON.parse(data);
          resolve({
            status: res.statusCode,
            latency,
            headers: res.headers,
            body: parsed,
            raw: data
          });
        } catch {
          resolve({
            status: res.statusCode,
            latency,
            headers: res.headers,
            body: null,
            raw: data
          });
        }
      });
    });

    req.on('error', (err) => {
      resolve({
        status: 0,
        latency: Date.now() - start,
        error: err.message
      });
    });

    req.setTimeout(10000, () => {
      req.destroy();
      resolve({
        status: 0,
        latency: Date.now() - start,
        error: 'Timeout'
      });
    });

    req.end();
  });
}

async function runTest(options) {
  const url = `${BASE_URL}${ENDPOINT}`;
  const tier = options.apiKey ? 'PRO' : 'FREE';
  const limit = options.apiKey ? 50000 : 1000;

  console.log(`\n🚀 TextForge Rate Limit Test`);
  console.log(`   Tier: ${tier} (limit: ${limit.toLocaleString()}/day)`);
  console.log(`   Requests: ${options.requests}`);
  console.log(`   Concurrency: ${options.concurrency}`);
  console.log(`   Base URL: ${BASE_URL}`);
  if (options.apiKey) console.log(`   API Key: ${options.apiKey.substring(0, 12)}...`);
  console.log('');

  const results = {
    total: 0,
    success: 0,
    rateLimited: 0,
    errors: 0,
    latencies: [],
    rateLimitHeaders: {}
  };

  // Process in batches
  for (let i = 0; i < options.requests; i += options.concurrency) {
    const batchSize = Math.min(options.concurrency, options.requests - i);
    const promises = [];

    for (let j = 0; j < batchSize; j++) {
      promises.push(makeRequest(url, options.apiKey));
    }

    const batchResults = await Promise.all(promises);

    for (const result of batchResults) {
      results.total++;
      results.latencies.push(result.latency);

      // Capture rate limit headers from first response
      if (results.total === 1 && result.headers) {
        results.rateLimitHeaders = {
          limit: result.headers['x-ratelimit-limit'],
          remaining: result.headers['x-ratelimit-remaining'],
          reset: result.headers['x-ratelimit-reset']
        };
      }

      if (result.status === 200 && result.body?.success) {
        results.success++;
        if (options.verbose) {
          console.log(`  ✓ ${result.latency}ms - ${result.body.result}`);
        }
      } else if (result.status === 429) {
        results.rateLimited++;
        console.log(`  🚫 RATE LIMITED (429) - ${result.latency}ms`);
        console.log(`     Retry-After: ${result.headers?.['retry-after'] || 'N/A'}s`);
        console.log(`     Body: ${JSON.stringify(result.body)}`);
      } else {
        results.errors++;
        if (options.verbose) {
          console.log(`  ✗ ${result.status} - ${result.latency}ms - ${result.error || result.raw}`);
        }
      }
    }

    // Progress
    const pct = Math.round((results.total / options.requests) * 100);
    process.stdout.write(`\r  Progress: ${results.total}/${options.requests} (${pct}%)`);

    // Delay between batches
    if (options.delay > 0 && i + batchSize < options.requests) {
      await new Promise(r => setTimeout(r, options.delay));
    }

    // Stop early if rate limited
    if (results.rateLimited > 0) {
      console.log('\n\n⚠️  Rate limit hit! Stopping test.');
      break;
    }
  }

  console.log('\n\n📊 Results Summary');
  console.log('══════════════════');
  console.log(`Total Requests:  ${results.total}`);
  console.log(`Successful:      ${results.success}`);
  console.log(`Rate Limited:    ${results.rateLimited}`);
  console.log(`Errors:          ${results.errors}`);

  if (results.latencies.length > 0) {
    const sorted = results.latencies.sort((a, b) => a - b);
    const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    console.log(`\nLatency (ms):`);
    console.log(`  Avg:   ${Math.round(avg)}`);
    console.log(`  Min:   ${sorted[0]}`);
    console.log(`  Max:   ${sorted[sorted.length - 1]}`);
    console.log(`  P50:   ${sorted[Math.floor(sorted.length * 0.5)]}`);
    console.log(`  P95:   ${sorted[Math.floor(sorted.length * 0.95)]}`);
    console.log(`  P99:   ${sorted[Math.floor(sorted.length * 0.99)]}`);
  }

  if (Object.keys(results.rateLimitHeaders).length > 0) {
    console.log(`\nRate Limit Headers (first response):`);
    console.log(`  X-RateLimit-Limit:     ${results.rateLimitHeaders.limit}`);
    console.log(`  X-RateLimit-Remaining: ${results.rateLimitHeaders.remaining}`);
    console.log(`  X-RateLimit-Reset:     ${results.rateLimitHeaders.reset} (${new Date(results.rateLimitHeaders.reset * 1000).toISOString()})`);
  }

  // Calculate requests per second
  const totalTime = results.latencies.reduce((a, b) => a + b, 0) / 1000;
  if (totalTime > 0) {
    console.log(`\nThroughput: ~${Math.round(results.total / totalTime)} req/s`);
  }

  console.log('');

  return results;
}

// Run
const options = parseArgs();
runTest(options).catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});