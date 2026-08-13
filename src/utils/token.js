import crypto from 'node:crypto';

/**
 * Generate a cryptographically secure random refresh token string
 * @returns {string} High-entropy random token string
 */
export const generateRandomToken = () => {
  return crypto.randomBytes(40).toString('hex');
};

/**
 * Hash a refresh token string using SHA-256 for DB storage
 * @param {string} token - Raw refresh token string
 * @returns {string} SHA-256 hash of token
 */
export const hashToken = (token) => {
  if (!token) return '';
  return crypto.createHash('sha256').update(token).digest('hex');
};
