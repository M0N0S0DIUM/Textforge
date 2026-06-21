const crypto = require('crypto');

const API_KEY_PREFIX = 'tf_pro_';
const API_KEY_BYTES = 16;
const API_KEY_HEX_LENGTH = API_KEY_BYTES * 2;
const API_KEY_FORMAT = new RegExp(`^${API_KEY_PREFIX}[a-f0-9]{${API_KEY_HEX_LENGTH}}$`);

function getApiKeySecret() {
  const secret = process.env.API_KEY_SECRET;
  if (!secret) {
    throw new Error(
      'Missing required environment variable: API_KEY_SECRET. TextForge will not start without it.'
    );
  }
  return secret;
}

const API_KEY_SECRET = getApiKeySecret();

function generateApiKey() {
  return `${API_KEY_PREFIX}${crypto.randomBytes(API_KEY_BYTES).toString('hex')}`;
}

function hashApiKey(apiKey) {
  // HMAC-SHA256 with a server secret is the industry-standard approach for
  // high-entropy API token verification. API keys are 128-bit random values
  // (crypto.randomBytes), so brute-force is computationally infeasible regardless
  // of hash speed. Slow KDFs (bcrypt/scrypt) are for low-entropy user passwords,
  // not high-entropy tokens. The server secret prevents offline dictionary attacks.
  // lgtm[js/insufficient-password-hash]
  return crypto.createHmac('sha256', API_KEY_SECRET).update(apiKey).digest('hex'); // lgtm[js/insufficient-password-hash]
}

function isApiKeyFormatValid(apiKey) {
  return typeof apiKey === 'string' && API_KEY_FORMAT.test(apiKey);
}

module.exports = {
  API_KEY_PREFIX,
  API_KEY_FORMAT,
  API_KEY_HEX_LENGTH,
  generateApiKey,
  hashApiKey,
  isApiKeyFormatValid,
  getApiKeySecret
};
