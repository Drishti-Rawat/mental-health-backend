const REFRESH_COOKIE_NAME = 'refreshToken';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000; // 30 days = 2,592,000,000 ms

/**
 * Set HTTP-only secure refresh token cookie on Express response
 * @param {Object} res - Express response object
 * @param {string} token - Raw refresh token string
 */
export const setRefreshCookie = (res, token) => {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: THIRTY_DAYS_MS,
    path: '/api/auth',
  });
};

/**
 * Clear refresh token cookie on Express response
 * @param {Object} res - Express response object
 */
export const clearRefreshCookie = (res) => {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/api/auth',
  });
};
