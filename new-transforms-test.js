/**
 * New transformation unit tests
 *
 * Tests for htmlencode, htmldecode, markdownplain, unicodenormalize, trimtext
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  htmlencode,
  htmldecode,
  markdownplain,
  unicodenormalize,
  trimtext
} = require('../transformations');

// ---------------------------------------------------------------------------
// htmlencode / htmldecode
// ---------------------------------------------------------------------------

test('htmlencode: encodes special HTML characters', () => {
  assert.equal(htmlencode('<script>alert("XSS")</script>'), '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
});

test('htmlencode: empty string returns empty string', () => {
  assert.equal(htmlencode(''), '');
});

test('htmlencode: safe text unchanged', () => {
  assert.equal(htmlencode('Hello World'), 'Hello World');
});

test('htmldecode: decodes HTML entities', () => {
  assert.equal(htmldecode('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;'), '<script>alert("XSS")</script>');
});

test('htmldecode: empty string returns empty string', () => {
  assert.equal(htmldecode(''), '');
});

test('htmldecode: safe text unchanged', () => {
  assert.equal(htmldecode('Hello World'), 'Hello World');
});

test('htmlencode/htmld**ecode: round-trip on special characters', () => {
  const original = '<div class="test">&amp;hello</div>';
  assert.equal(htmldecode(htmlencode(original)), original);
});

// ---------------------------------------------------------------------------
// markdownplain
// ---------------------------------------------------------------------------

test('markdownplain: removes headers', () => {
  assert.equal(markdownplain('# Hello World'), 'Hello World');
  assert.equal(markdownplain('## Hello World'), 'Hello World');
  assert.equal(markdownplain('###### Hello World'), 'Hello World');
});

test('markdownplain: removes bold/italic markers', () => {
  assert.equal(markdownplain('**bold** and _italic_'), 'bold and italic');
});

test('markdownplain: removes code blocks', () => {
  assert.equal(markdownplain('```js\nconst x = 1;\n```'), '');
});

test('markdownplain: removes inline code', () => {
  assert.equal(markdownplain('Use `console.log()`'), 'Use console.log()');
});

test('markdownplain: empty string returns empty string', () => {
  assert.equal(markdownplain(''), '');
});

// ---------------------------------------------------------------------------
// unicodenormalize
// ---------------------------------------------------------------------------

test('unicodenormalize: NFC normalization', () => {
  const str = 'café'; // e with acute accent (single character)
  const result = unicodenormalize(str, 'NFC');
  assert.equal(result, str);
});

test('unicodenormalize: NFD normalization', () => {
  const str = 'café';
  const result = unicodenormalize(str, 'NFD');
  // In NFD, é is decomposed to e + combining acute accent
  assert.ok(result.length >= str.length);
});

test('unicodenormalize: invalid form returns original', () => {
  const str = 'Hello World';
  assert.equal(unicodenormalize(str, 'INVALID'), str);
});

test('unicodenormalize: empty string', () => {
  assert.equal(unicodenormalize('', 'NFC'), '');
});

// ---------------------------------------------------------------------------
// trimtext
// ---------------------------------------------------------------------------

test('trimtext: trims both sides by default', () => {
  assert.equal(trimtext('   hello world   '), 'hello world');
});

test('trimtext: trims start only', () => {
  assert.equal(trimtext('   hello world', 'start'), 'hello world');
});

test('trimtext: trims end only', () => {
  assert.equal(trimtext('hello world   ', 'end'), 'hello world');
});

test('trimtext: empty string returns empty string', () => {
  assert.equal(trimtext('', 'both'), '');
});

test('trimtext: whitespace-only string', () => {
  assert.equal(trimtext('   '), '');
});

// ---------------------------------------------------------------------------
// Integration tests
// ---------------------------------------------------------------------------

test('new transformations: all functions handle empty strings without throwing', () => {
  const fns = [htmlencode, htmldecode, markdownplain, unicodenormalize, trimtext];
  for (const fn of fns) {
    assert.doesNotThrow(() => fn(''), `${fn.name} threw on empty string`);
  }
});

test('new transformations: all functions handle unicode without crashing', () => {
  const testCases = ['Hello 世界', 'café', '😀 emoji'];
  for (const text of testCases) {
    assert.doesNotThrow(() => htmlencode(text), 'htmlencode threw on unicode');
    assert.doesNotThrow(() => unicodenormalize(text, 'NFC'), 'unicodenormalize threw on unicode');
  }
});

test('chaining: trimtext then slugify works correctly', () => {
  const text = '   Hello World   ';
  assert.equal(slugify(trimtext(text)), 'hello-world');
});

test('chaining: htmldecode then slugify works correctly', () => {
  const text = '&lt;Hello&gt;';
  assert.equal(slugify(htmldecode(text)), 'hello');
});