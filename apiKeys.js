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
  return crypto.createHmac('sha256', API_KEY_SECRET).update(apiKey).digest('hex');
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
