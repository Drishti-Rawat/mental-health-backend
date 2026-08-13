import jwt from 'jsonwebtoken';

/**
 * Generate a short-lived access token JWT (15 minutes default)
 * @param {Object} user - User object containing _id and role
 * @returns {string} JWT access token string
 */
export const generateAccessToken = (user) => {
  const payload = {
    sub: user._id.toString(),
    role: user.role,
    type: 'access',
  };

  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  });
};

/**
 * Verify access token JWT
 * @param {string} token - JWT access token string
 * @returns {Object} Decoded payload
 */
export const verifyAccessToken = (token) => {
  const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
  if (decoded.type !== 'access') {
    throw new Error('Invalid token type');
  }
  return decoded;
};
