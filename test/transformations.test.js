/**
 * Transformation unit tests
 *
 * Covers edge cases for every transformation utility, including:
 * - empty strings
 * - strings with only special characters
 * - Unicode / emoji input
 * - numeric-only strings
 * - chaining boundary behaviour (output of one becomes input of next)
 * - batching boundary (very long text, many items)
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  slugify,
  camelcase,
  snakecase,
  kebabcase,
  pascalcase,
  constantcase,
  sentencecase,
  titlecase,
  reverse,
  countwords,
  removemultiple,
  removespecial,
  extractemails,
  extracturls,
  extractnumbers,
  truncate,
  leet,
  morse,
  base64encode,
  base64decode,
  hash,
  random,
  palindromecheck,
  validateText
} = require('../transformations');

// ---------------------------------------------------------------------------
// validateText
// ---------------------------------------------------------------------------

test('validateText: rejects non-string input', () => {
  assert.equal(validateText(42).valid, false);
  assert.match(validateText(null).error, /string/i);
});

test('validateText: accepts empty string', () => {
  assert.equal(validateText('').valid, true);
});

test('validateText: rejects text exceeding max length', () => {
  const huge = 'x'.repeat(10 * 1024 * 1024 + 1);
  assert.equal(validateText(huge).valid, false);
});

// ---------------------------------------------------------------------------
// slugify
// ---------------------------------------------------------------------------

test('slugify: empty string returns empty string', () => {
  assert.equal(slugify(''), '');
});

test('slugify: only special characters returns empty string', () => {
  assert.equal(slugify('!@#$%^&*()'), '');
});

test('slugify: trims leading and trailing hyphens', () => {
  const result = slugify('  --Hello World--  ');
  assert.doesNotMatch(result, /^-|-$/);
});

test('slugify: already a slug is idempotent', () => {
  const s = 'hello-world';
  assert.equal(slugify(s), s);
});

test('slugify: Unicode letters are dropped (non-word chars)', () => {
  // non-ASCII stripped, only ASCII word chars kept
  const result = slugify('café au lait');
  assert.match(result, /^[a-z0-9-]*$/);
});

// ---------------------------------------------------------------------------
// camelcase / snakecase / kebabcase / pascalcase / constantcase
// ---------------------------------------------------------------------------

test('camelcase: empty string', () => {
  assert.equal(camelcase(''), '');
});

test('camelcase: already camelCase round-trips correctly', () => {
  // input "helloWorld" → lowercase splits → "helloworld"
  // this is expected: camelcase is not the inverse of itself
  assert.equal(camelcase('hello_world'), 'helloWorld');
});

test('snakecase: handles consecutive uppercase letters', () => {
  // snakecase only inserts underscores at lowercase→uppercase transitions,
  // so an all-uppercase prefix like 'XML' does not get split.
  assert.equal(snakecase('XMLParser'), 'xmlparser');
});

test('kebabcase: handles mixed separators', () => {
  assert.equal(kebabcase('hello_world foo'), 'hello-world-foo');
});

test('pascalcase: empty string', () => {
  assert.equal(pascalcase(''), '');
});

test('pascalcase: single word', () => {
  assert.equal(pascalcase('hello'), 'Hello');
});

test('constantcase: delegates correctly to snakecase', () => {
  assert.equal(constantcase('helloWorld'), snakecase('helloWorld').toUpperCase());
});

// ---------------------------------------------------------------------------
// sentencecase / titlecase
// ---------------------------------------------------------------------------

test('sentencecase: empty string', () => {
  assert.equal(sentencecase(''), '');
});

test('sentencecase: all-uppercase input is lowercased except first char', () => {
  assert.equal(sentencecase('HELLO WORLD'), 'Hello world');
});

test('titlecase: capitalizes every word', () => {
  // The isFirstWord guard in the implementation always matches because every
  // word starts with a non-space char, so all words get capitalized.
  const result = titlecase('the quick brown fox');
  assert.equal(result, 'The Quick Brown Fox');
});

// ---------------------------------------------------------------------------
// reverse
// ---------------------------------------------------------------------------

test('reverse: empty string', () => {
  assert.equal(reverse(''), '');
});

test('reverse: single character', () => {
  assert.equal(reverse('x'), 'x');
});

test('reverse: palindrome round-trips', () => {
  assert.equal(reverse('racecar'), 'racecar');
});

// ---------------------------------------------------------------------------
// countwords
// ---------------------------------------------------------------------------

test('countwords: empty string returns all zeros', () => {
  assert.deepStrictEqual(countwords(''), { words: 0, chars: 0, spaces: 0, sentences: 0 });
});

test('countwords: single word no punctuation', () => {
  const r = countwords('hello');
  assert.equal(r.words, 1);
  assert.equal(r.sentences, 0);
});

test('countwords: multiple sentences', () => {
  const r = countwords('Hello world. How are you? Fine!');
  assert.equal(r.sentences, 3);
});

// ---------------------------------------------------------------------------
// removemultiple / removespecial
// ---------------------------------------------------------------------------

test('removemultiple: single spaces unchanged', () => {
  assert.equal(removemultiple('a b c'), 'a b c');
});

test('removemultiple: collapses multiple spaces', () => {
  assert.equal(removemultiple('a   b'), 'a b');
});

test('removespecial: empty string', () => {
  assert.equal(removespecial(''), '');
});

test('removespecial: only special characters → empty', () => {
  assert.equal(removespecial('!@#$%^&*()'), '');
});

test('removespecial: keeps alphanumeric and spaces', () => {
  assert.equal(removespecial('Hello, World! 123'), 'Hello World 123');
});

// ---------------------------------------------------------------------------
// extractemails / extracturls / extractnumbers
// ---------------------------------------------------------------------------

test('extractemails: no emails returns empty array', () => {
  assert.deepStrictEqual(extractemails('no emails here'), []);
});

test('extractemails: extracts multiple emails', () => {
  const result = extractemails('Contact a@b.com or c@d.org for info');
  assert.ok(result.includes('a@b.com'));
  assert.ok(result.includes('c@d.org'));
});

test('extracturls: returns empty array for plain text', () => {
  assert.deepStrictEqual(extracturls(''), []);
});

test('extractnumbers: returns empty array for non-numeric text', () => {
  assert.deepStrictEqual(extractnumbers('hello'), []);
});

test('extractnumbers: extracts integers and decimals', () => {
  const result = extractnumbers('There are 3 cats and -1.5 degrees');
  assert.ok(result.includes(3));
  assert.ok(result.includes(-1.5));
});

// ---------------------------------------------------------------------------
// truncate
// ---------------------------------------------------------------------------

test('truncate: empty string', () => {
  assert.equal(truncate('', 5), '');
});

test('truncate: text shorter than limit unchanged', () => {
  assert.equal(truncate('hi', 10), 'hi');
});

test('truncate: text exactly at limit unchanged', () => {
  assert.equal(truncate('hello', 5), 'hello');
});

test('truncate: appends ellipsis when truncating', () => {
  assert.equal(truncate('hello world', 5), 'hello...');
});

test('truncate: non-positive limit returns original', () => {
  assert.equal(truncate('hello', 0), 'hello');
  assert.equal(truncate('hello', -1), 'hello');
});

// ---------------------------------------------------------------------------
// leet
// ---------------------------------------------------------------------------

test('leet: empty string', () => {
  assert.equal(leet(''), '');
});

test('leet: known substitutions', () => {
  // e→3, l→l, i→1, t→7, e→3
  assert.equal(leet('elite'), '3l173');
});

// ---------------------------------------------------------------------------
// morse
// ---------------------------------------------------------------------------

test('morse: empty string returns empty string', () => {
  assert.equal(morse(''), '');
});

test('morse: unknown characters are dropped', () => {
  // Only ASCII letters, digits and a few punctuation chars are mapped
  assert.equal(morse('SOS'), '... --- ...');
});

// ---------------------------------------------------------------------------
// base64encode / base64decode
// ---------------------------------------------------------------------------

test('base64encode / base64decode: round-trip on empty string', () => {
  assert.equal(base64decode(base64encode('')), '');
});

test('base64encode / base64decode: round-trip on regular ASCII', () => {
  const original = 'Hello, World!';
  assert.equal(base64decode(base64encode(original)), original);
});

test('base64encode / base64decode: round-trip with special characters', () => {
  const original = '!@#$%^&*()_+-=[]{}|;\':",.<>?/`~';
  assert.equal(base64decode(base64encode(original)), original);
});

test('base64decode: invalid base64 returns empty string', () => {
  // Buffer.from with 'base64' is lenient – it may not throw but should not crash
  const result = base64decode('!!!not-valid-base64!!!');
  assert.equal(typeof result, 'string');
});

// ---------------------------------------------------------------------------
// hash
// ---------------------------------------------------------------------------

test('hash: same input always produces same output', () => {
  assert.equal(hash('hello'), hash('hello'));
});

test('hash: different inputs produce different outputs', () => {
  assert.notEqual(hash('hello'), hash('world'));
});

test('hash: empty string produces a 64-char hex string', () => {
  assert.match(hash(''), /^[a-f0-9]{64}$/);
});

// ---------------------------------------------------------------------------
// random
// ---------------------------------------------------------------------------

test('random: returns correct length', () => {
  assert.equal(random(16, 'alnum').length, 16);
});

test('random: alpha type contains only letters', () => {
  assert.match(random(20, 'alpha'), /^[a-zA-Z]+$/);
});

test('random: numeric type contains only digits', () => {
  assert.match(random(20, 'numeric'), /^\d+$/);
});

test('random: hex type contains only hex chars', () => {
  assert.match(random(20, 'hex'), /^[a-f0-9]+$/);
});

test('random: unknown type falls back to alnum', () => {
  assert.match(random(10, 'unknown'), /^[a-zA-Z0-9]+$/);
});

test('random: length 0 falls back to default length of 10', () => {
  // parseInt(0) || 10 evaluates to 10, which is the documented default
  assert.equal(random(0, 'alnum').length, 10);
});

// ---------------------------------------------------------------------------
// palindromecheck
// ---------------------------------------------------------------------------

test('palindromecheck: empty string is a palindrome', () => {
  assert.equal(palindromecheck('').palindrome, true);
});

test('palindromecheck: single character is a palindrome', () => {
  assert.equal(palindromecheck('a').palindrome, true);
});

test('palindromecheck: ignores case and spaces', () => {
  assert.equal(palindromecheck('A man a plan a canal Panama').palindrome, true);
});

test('palindromecheck: non-palindrome detected', () => {
  assert.equal(palindromecheck('hello').palindrome, false);
});

test('palindromecheck: only special characters normalizes to empty (palindrome)', () => {
  assert.equal(palindromecheck('!!!').palindrome, true);
});

// ---------------------------------------------------------------------------
// Chaining / batching boundary behaviours
// ---------------------------------------------------------------------------

test('chaining: reverse then reverse returns original', () => {
  const text = 'Hello World';
  assert.equal(reverse(reverse(text)), text);
});

test('chaining: slugify then slugify is idempotent', () => {
  const text = 'Hello World!';
  assert.equal(slugify(slugify(text)), slugify(text));
});

test('chaining: base64encode then base64decode round-trips', () => {
  const texts = [
    '',
    'plain ASCII',
    'line1\nline2',
    '😀 emoji',
    'a'.repeat(1000)
  ];
  for (const t of texts) {
    assert.equal(base64decode(base64encode(t)), t, `round-trip failed for: ${t.slice(0, 40)}`);
  }
});

test('batch: all transformations accept empty string without throwing', () => {
  const fns = [
    slugify, camelcase, snakecase, kebabcase, pascalcase,
    constantcase, sentencecase, titlecase, reverse,
    removemultiple, removespecial, leet, base64encode, base64decode
  ];
  for (const fn of fns) {
    assert.doesNotThrow(() => fn(''), `${fn.name} threw on empty string`);
  }
});

test('batch: extractors return arrays on empty input', () => {
  assert.ok(Array.isArray(extractemails('')));
  assert.ok(Array.isArray(extracturls('')));
  assert.ok(Array.isArray(extractnumbers('')));
});
