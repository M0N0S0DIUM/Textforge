const axios = require('axios');

const BASE_URL = 'https://textforge.co';

const tests = [
  // String formatting
  { op: 'slugify', input: 'Hello World!', expected: 'hello-world' },
  { op: 'camelcase', input: 'hello world', expected: 'helloWorld' },
  { op: 'snakecase', input: 'Hello World', expected: 'hello_world' },
  { op: 'kebabcase', input: 'Hello World', expected: 'hello-world' },
  { op: 'pascalcase', input: 'hello world', expected: 'HelloWorld' },
  { op: 'constantcase', input: 'hello world', expected: 'HELLO_WORLD' },
  { op: 'capitalize', input: 'hello world', expected: 'Hello world' },
  { op: 'titlecase', input: 'hello world', expected: 'Hello World' },
  { op: 'sentencecase', input: 'HELLO WORLD', expected: 'Hello world' },
  
  // String manipulation
  { op: 'reverse', input: 'hello', expected: 'olleh' },
  { op: 'uppercase', input: 'hello', expected: 'HELLO' },
  { op: 'lowercase', input: 'HELLO', expected: 'hello' },
  { op: 'trim', input: '  hello  ', expected: 'hello' },
  { op: 'truncate', input: 'hello world', params: { length: 5 }, expected: 'hello...' },
  
  // Encoding/decoding
  { op: 'base64encode', input: 'hello', expected: 'aGVsbG8=' },
  { op: 'base64decode', input: 'aGVsbG8=', expected: 'hello' },
  { op: 'urlencode', input: 'hello world', expected: 'hello%20world' },
  { op: 'urldecode', input: 'hello%20world', expected: 'hello world' },
  { op: 'htmlencode', input: '<div>', expected: '&lt;div&gt;' },
  { op: 'htmldecode', input: '&lt;div&gt;', expected: '<div>' },
  
  // Analysis
  { op: 'wordcount', input: 'hello world foo', expected: 3 },
  { op: 'charcount', input: 'hello', expected: 5 },
  { op: 'linecount', input: 'line1\nline2\nline3', expected: 3 },
  
  // Extraction
  { op: 'extractemails', input: 'Contact us at test@example.com or admin@example.org', expected: ['test@example.com', 'admin@example.org'] },
  { op: 'extracturls', input: 'Visit https://example.com or http://test.org', expected: ['https://example.com', 'http://test.org'] },
  { op: 'extractnumbers', input: 'I have 5 apples and 10 oranges', expected: [5, 10] },
  
  // Cleaning
  { op: 'removehtml', input: '<p>Hello</p>', expected: 'Hello' },
  { op: 'removespecial', input: 'hello!@#$world', expected: 'helloworld' },
];

async function runTests() {
  console.log('Testing all 28 transformations...\n');
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      const params = { input: test.input, operation: test.op };
      if (test.params) Object.assign(params, test.params);
      
      const response = await axios.get(`${BASE_URL}/v1/run`, { params });
      const result = response.data.result;
      
      const success = JSON.stringify(result) === JSON.stringify(test.expected);
      
      if (success) {
        console.log(`✓ ${test.op}: ${JSON.stringify(test.input)} → ${JSON.stringify(result)}`);
        passed++;
      } else {
        console.log(`✗ ${test.op}: Expected ${JSON.stringify(test.expected)}, got ${JSON.stringify(result)}`);
        failed++;
      }
    } catch (error) {
      console.log(`✗ ${test.op}: Error - ${error.message}`);
      failed++;
    }
  }
  
  console.log(`\n${passed} passed, ${failed} failed out of ${tests.length} tests`);
  return failed === 0;
}

runTests().then(success => process.exit(success ? 0 : 1));
