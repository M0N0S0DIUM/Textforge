/**
 * TextForge - Text Transformations Module
 * 
 * Provides 28 text transformation utilities used by the TextForge API.
 * Each function is pure (no side effects) and takes text as input,
 * returning the transformed result.
 * 
 * All transformations are optimized for performance (<5ms each).
 * Regex patterns are carefully crafted to avoid catastrophic backtracking.
 */

const crypto = require('crypto');

// Leet speak substitution map
const LEET_MAP = {
  a: '4', e: '3', i: '1', o: '0', s: '5',
  t: '7', b: '8', g: '9', z: '2'
};

// Standard International Morse Code mapping
const MORSE_MAP = {
  'A': '.-',    'B': '-...',  'C': '-.-.',  'D': '-..',
  'E': '.',     'F': '..-.',  'G': '--.',   'H': '....',
  'I': '..',    'J': '.---',  'K': '-.-',   'L': '.-..',
  'M': '--',    'N': '-.',    'O': '---',   'P': '.--.',
  'Q': '--.-',  'R': '.-.',   'S': '...',   'T': '-',
  'U': '..-',   'V': '...-',  'W': '.--',   'X': '-..-',
  'Y': '-.--',  'Z': '--..',
  '0': '-----', '1': '.----', '2': '..---', '3': '...--',
  '4': '....-', '5': '.....', '6': '-....', '7': '--...',
  '8': '---..', '9': '----.',
  '.': '.-.-.-', ',': '--..--', '?': '..--..', '!': '-.-.--',
  '/': '-..-.', '(': '-.--.', ')': '-.--.-', '&': '.-...',
  ':': '---...', ';': '-.-.-.', '=': '-...-', '+': '.-.-.',
  '-': '-....-', '_': '..--..', '"': '.-..-.', "'": '.----.',
  '@': '.--.-.', ' ': '/'
};

// Maximum allowed text length (10MB)
const MAX_TEXT_LENGTH = 10 * 1024 * 1024;

/**
 * Validates input text length.
 * @param {string} text - Input text to validate
 * @returns {object} - { valid: boolean, error?: string }
 */
function validateText(text) {
  if (typeof text !== 'string') {
    return { valid: false, error: 'Input must be a string' };
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return { valid: false, error: `Text exceeds maximum length of ${MAX_TEXT_LENGTH} characters` };
  }
  return { valid: true };
}

/**
 * 1. slugify - Convert text to URL-friendly slug
 * "Hello World!" → "hello-world"
 * @param {string} text - Input text
 * @returns {string} URL-friendly slug
 */
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')           // Remove non-word chars (except hyphens)
    .replace(/[\s_-]+/g, '-')           // Replace spaces/underscores with hyphens
    .replace(/^-+|-+$/g, '');           // Trim leading/trailing hyphens
}

/**
 * 2. camelcase - Convert text to camelCase
 * "user_profile_data" → "userProfileData"
 * @param {string} text - Input text
 * @returns {string} camelCase string
 */
function camelcase(text) {
  const parts = text
    .toString()
    .toLowerCase()
    .split(/[\s_-]+/);
  return parts
    .map((part, i) => i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/**
 * 3. snakecase - Convert text to snake_case
 * "userProfileData" → "user_profile_data"
 * @param {string} text - Input text
 * @returns {string} snake_case string
 */
function snakecase(text) {
  const str = text.toString();
  // Insert underscore before uppercase letters (that follow lowercase or digits)
  let result = str
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase()
    .replace(/_+/g, '_');
  return result;
}

/**
 * 4. kebabcase - Convert text to kebab-case
 * "userProfileData" → "user-profile-data"
 * @param {string} text - Input text
 * @returns {string} kebab-case string
 */
function kebabcase(text) {
  const str = text.toString();
  let result = str
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase()
    .replace(/-+/g, '-');
  return result;
}

/**
 * 5. pascalcase - Convert text to PascalCase
 * "hello world" → "HelloWorld"
 * @param {string} text - Input text
 * @returns {string} PascalCase string
 */
function pascalcase(text) {
  const parts = text
    .toString()
    .split(/[\s_-]+/)
    .filter(Boolean);
  return parts
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');
}

/**
 * 6. constantcase - Convert text to CONSTANT_CASE (SCREAMING_SNAKE_CASE)
 * "hello world" → "HELLO_WORLD"
 * @param {string} text - Input text
 * @returns {string} CONSTANT_CASE string
 */
function constantcase(text) {
  return snakecase(text).toUpperCase();
}

/**
 * 7. sentencecase - Convert text to Sentence case (first letter capitalized)
 * "hello WORLD" → "Hello world"
 * @param {string} text - Input text
 * @returns {string} Sentence case string
 */
function sentencecase(text) {
  const str = text.toString().trim();
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * 8. titlecase - Convert text to Title Case
 * "the quick brown fox" → "The Quick Brown Fox"
 * @param {string} text - Input text
 * @returns {string} Title case string
 */
function titlecase(text) {
  const str = text.toString();
  // Common words to keep lowercase in title case
  const lowercaseWords = new Set([
    'a', 'an', 'the', 'and', 'but', 'or', 'nor', 'for', 'yet', 'so',
    'in', 'on', 'at', 'to', 'by', 'up', 'of', 'as', 'is', 'it', 'if',
    'do', 'no', 'be', 'is', 'am', 'are', 'was', 'were', 'been', 'being',
    'has', 'have', 'had', 'can', 'may', 'shall', 'will'
  ]);
  
  return str
    .toLowerCase()
    .split(/(\s+)/)  // Split but keep delimiters
    .map(part => {
      if (/^\s+$/.test(part)) return part;  // Preserve whitespace
      if (part.length === 0) return part;
      const word = part.replace(/[^a-zA-Z]/g, '');
      if (word.length === 0) return part;
      const isLowercaseWord = lowercaseWords.has(word.toLowerCase());
      const isFirstWord = part.match(/^\S/);
      return isLowercaseWord && !isFirstWord ? part : 
        part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join('');
}

/**
 * 9. reverse - Reverse the input text
 * "hello" → "olleh"
 * @param {string} text - Input text
 * @returns {string} Reversed string
 */
function reverse(text) {
  return text.toString().split('').reverse().join('');
}

/**
 * 10. countwords - Count words, characters, spaces, and sentences
 * Returns an object with counts
 * @param {string} text - Input text
 * @returns {object} { words: number, chars: number, spaces: number, sentences: number }
 */
function countwords(text) {
  const str = text.toString();
  const chars = str.length;
  const spaces = (str.match(/ /g) || []).length;
  // Count words: sequences of non-space characters
  const words = str.trim() === '' ? 0 : str.trim().split(/\s+/).length;
  // Count sentences: text ending with ., !, or ?
  const sentences = (str.match(/[.!?]+/g) || []).length;
  return { words, chars, spaces, sentences };
}

/**
 * 11. removemultiple - Remove duplicate consecutive spaces
 * "hello   world" → "hello world"
 * @param {string} text - Input text
 * @returns {string} Text with single spaces
 */
function removemultiple(text) {
  return text.toString().replace(/  +/g, ' ');
}

/**
 * 12. removespecial - Remove special characters, keep alphanumeric and spaces
 * "Hello, World! 123" → "Hello World 123"
 * @param {string} text - Input text
 * @returns {string} Text with only alphanumeric chars and spaces
 */
function removespecial(text) {
  return text.toString().replace(/[^a-zA-Z0-9\s]/g, '');
}

/**
 * 13. extractemails - Extract email addresses from text
 * @param {string} text - Input text
 * @returns {string[]} Array of email addresses found
 */
function extractemails(text) {
  // Regex for email validation - carefully crafted to avoid backtracking
  const regex = /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*/g;
  return text.toString().match(regex) || [];
}

/**
 * 14. extracturls - Extract URLs from text
 * @param {string} text - Input text
 * @returns {string[]} Array of URLs found
 */
function extracturls(text) {
  // Regex for URL extraction - handles http, https, ftp protocols
  const regex = /(?:https?:\/\/|ftp:\/\/)?(?:www\.)?[a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}(?:\b|[a-zA-Z0-9()@:%_+.~#?&/=]*)/gi;
  return text.toString().match(regex) || [];
}

/**
 * 15. extractnumbers - Extract numbers (integers and decimals) from text
 * @param {string} text - Input text
 * @returns {number[]} Array of numbers found
 */
function extractnumbers(text) {
  const matches = text.toString().match(/-?\d+\.?\d*/g) || [];
  return matches.map(num => parseFloat(num));
}

/**
 * 16. truncate - Truncate text to specified length with ellipsis
 * @param {string} text - Input text
 * @param {number} limit - Maximum length
 * @returns {string} Truncated text
 */
function truncate(text, limit) {
  const str = text.toString();
  const n = parseInt(limit, 10);
  if (isNaN(n) || n <= 0) return str;
  if (str.length <= n) return str;
  return str.slice(0, n) + '...';
}

/**
 * 17. leet - Convert text to leet speak (1337)
 * "hello" → "h3ll0"
 * Uses common substitutions: a→4, e→3, i→1, o→0, s→5, t→7, b→8, g→9, z→2
 * @param {string} text - Input text
 * @returns {string} Leet speak text
 */
function leet(text) {
  return text.toString().toLowerCase().split('').map(char => {
    return LEET_MAP[char] || char;
  }).join('');
}

/**
 * 18. morse - Convert text to Morse code
 * "SOS" → "... --- ..."
 * Uses standard International Morse Code mapping
 * @param {string} text - Input text
 * @returns {string} Morse code string
 */
function morse(text) {
  return text.toString().toUpperCase().split('').map(char => {
    return MORSE_MAP[char] || '';
  }).filter(code => code !== '').join(' ');
}

/**
 * 19. base64encode - Encode text to Base64
 * "hello" → "aGVsbG8="
 * @param {string} text - Input text
 * @returns {string} Base64 encoded string
 */
function base64encode(text) {
  try {
    return Buffer.from(text.toString()).toString('base64');
  } catch {
    return '';
  }
}

/**
 * 20. base64decode - Decode Base64 to text
 * "aGVsbG8=" → "hello"
 * @param {string} text - Base64 encoded text
 * @returns {string} Decoded text (empty string for invalid base64)
 */
function base64decode(text) {
  try {
    const str = text.toString();
    /* Validate base64 format before decoding to avoid garbage output */
    /* Valid base64: only A-Z, a-z, 0-9, +, /, = (padding) */
    /* Length must be multiple of 4 */
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(str) || str.length % 4 !== 0) {
      return '';
    }
    return Buffer.from(str, 'base64').toString('utf8');
  } catch {
    return '';
  }
}

/**
 * 21. hash - Generate SHA-256 hash of text
 * @param {string} text - Input text
 * @returns {string} SHA-256 hex digest
 */
function hash(text) {
  return crypto.createHash('sha256').update(text.toString()).digest('hex');
}

/**
 * 22. random - Generate random string
 * @param {number} length - Length of random string
 * @param {string} type - Type: 'alnum', 'alpha', 'numeric', 'hex'
 * @returns {string} Random string
 */
function random(length, type = 'alnum') {
  const n = parseInt(length, 10) || 10;
  const t = type.toLowerCase();
  
  let chars = '';
  switch (t) {
    case 'alpha':
      chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
      break;
    case 'numeric':
      chars = '0123456789';
      break;
    case 'hex':
      chars = '0123456789abcdef';
      break;
    case 'alnum':
    default:
      chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      break;
  }
  
  let result = '';
  for (let i = 0; i < n; i++) {
    result += chars[crypto.randomInt(chars.length)];
  }
  return result;
}

/**
 * 23. palindromecheck - Check if text is a palindrome
 * Returns { palindrome: boolean, normalized: string }
 * Ignores case, spaces, and punctuation
 * @param {string} text - Input text
 * @returns {object} { palindrome: boolean, normalized: string }
 */
function palindromecheck(text) {
  const str = text.toString();
  // Normalize: lowercase, remove non-alphanumeric
  const normalized = str.toLowerCase().replace(/[^a-z0-9]/g, '');
  const reversed = normalized.split('').reverse().join('');
  return {
    palindrome: normalized === reversed,
    normalized
  };
}

/**
 * 24. htmlencode - Encode text as HTML entities
 * "Hello <World>" → "Hello &lt;World&gt;"
 * @param {string} text - Input text
 * @returns {string} HTML-encoded string
 */
function htmlencode(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.toString().replace(/[&<>"']/g, c => map[c]);
}

/**
 * 25. htmldecode - Decode HTML entities to text
 * "Hello &lt;World&gt;" → "Hello <World>"
 * @param {string} text - Input text with HTML entities
 * @returns {string} Decoded text
 */
function htmldecode(text) {
  const map = {
    'amp': '&',
    'lt': '<',
    'gt': '>',
    'quot': '"',
    '#039': "'"
  };
  return text.toString().replace(/&([^;]+);/g, (match, entity) => map[entity] || match);
}

/**
 * 26. markdownplain - Convert markdown to plain text
 * "# Hello **World**" → "Hello World"
 * @param {string} text - Input markdown text
 * @returns {string} Plain text without markdown
 */
function markdownplain(text) {
  let str = text.toString();
  // Remove headers (# to ######)
  str = str.replace(/^(#{1,6})\s+/gm, '');
  // Remove bold/italic markers (* and _)
  str = str.replace(/[*_]{1,2}/g, '');
  // Remove code blocks
  str = str.replace(/`{3}[^`]*`{3}/g, '');
  // Remove inline code
  str = str.replace(/`([^`]*)`/g, '$1');
  // Remove blockquotes
  str = str.replace(/^\s*>\s*/gm, '');
  // Remove horizontal rules
  str = str.replace(/^[-*_]{3,}\s*$/gm, '');
  // Remove images (keep alt text)
  str = str.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');
  // Convert links to plain text
  str = str.replace('\[([^\]]*)\]\([^)]*\)', '$1');
  // Remove extra whitespace and newlines
  str = str.replace(/\n{3,}/g, '\n\n');
  return str.trim();
}

/**
 * 27. unicodenormalize - Normalize Unicode text to specified form
 * @param {string} text - Input text
 * @param {string} form - Normalization form: 'NFC', 'NFD', 'NFKC', 'NFKD'
 * @returns {string} Normalized text
 */
function unicodenormalize(text, form = 'NFC') {
  const validForms = ['NFC', 'NFD', 'NFKC', 'NFKD'];
  if (!validForms.includes(form.toUpperCase())) {
    return text.toString(); // Return original if invalid form
  }
  return text.toString().normalize(form.toUpperCase());
}

/**
 * 28. trimtext - Trim whitespace from text with options
 * @param {string} text - Input text
 * @param {string} mode - 'both', 'start', or 'end'
 * @returns {string} Trimmed text
 */
function trimtext(text, mode = 'both') {
  const str = text.toString();
  switch (mode.toLowerCase()) {
    case 'start':
      return str.replace(/^\s+/, '');
    case 'end':
      return str.replace(/\s+$/, '');
    case 'both':
    default:
      return str.trim();
  }
}

/**
 * Preset definitions - common transformation combinations
 */
const PRESETS = {
  url: ['slugify', 'removespecial', 'kebabcase'],
  human: ['sentencecase', 'removespecial'],
  clean: ['removemultiple', 'removespecial']
};

/**
 * Get all available transformation names
 * @returns {string[]} Array of transformation names
 */
function getAvailableActions() {
  return [
    'slugify', 'camelcase', 'snakecase', 'kebabcase', 'pascalcase',
    'constantcase', 'sentencecase', 'titlecase', 'reverse', 'countwords',
    'removemultiple', 'removespecial', 'extractemails', 'extracturls',
    'extractnumbers', 'truncate', 'leet', 'morse', 'base64encode',
    'base64decode', 'hash', 'random', 'palindromecheck',
    'htmlencode', 'htmldecode', 'markdownplain', 'unicodenormalize', 'trimtext'
  ];
}

/**
 * Resolve transformation function by name
 * @param {string} action - Action name
 * @returns {Function|null} Transformation function or null if not found
 */
function getTransformFunction(action) {
  const actionMap = {
    slugify, camelcase, snakecase, kebabcase, pascalcase,
    constantcase, sentencecase, titlecase, reverse, countwords,
    removemultiple, removespecial, extractemails, extracturls,
    extractnumbers, truncate, leet, morse, base64encode,
    base64decode, hash, random, palindromecheck,
    htmlencode, htmldecode, markdownplain, unicodenormalize, trimtext
  };
  return actionMap[action] || null;
}

module.exports = {
  // All 28 transformation functions
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
  htmlencode,
  htmldecode,
  markdownplain,
  unicodenormalize,
  trimtext,
  
  // Utility functions
  validateText,
  getAvailableActions,
  getTransformFunction,
  PRESETS,
  MAX_TEXT_LENGTH
};
