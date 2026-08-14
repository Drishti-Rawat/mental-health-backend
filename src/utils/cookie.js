const REFRESH_COOKIE_NAME = 'refreshToken';
const ADMIN_REFRESH_COOKIE_NAME = 'adminRefreshToken';
const THERAPIST_REFRESH_COOKIE_NAME = 'therapistRefreshToken';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const cookieOptions = (path = '/') => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge: THIRTY_DAYS_MS,
  path,
});

/**
 * Set HTTP-only secure refresh token cookie for Patients
 */
export const setRefreshCookie = (res, token) => {
  res.cookie(REFRESH_COOKIE_NAME, token, cookieOptions('/'));
};

export const clearRefreshCookie = (res) => {
  res.clearCookie(REFRESH_COOKIE_NAME, cookieOptions('/'));
};

/**
 * Set HTTP-only secure refresh token cookie for Admins & Supervisors
 */
export const setAdminRefreshCookie = (res, token) => {
  res.cookie(ADMIN_REFRESH_COOKIE_NAME, token, cookieOptions('/'));
};

export const clearAdminRefreshCookie = (res) => {
  res.clearCookie(ADMIN_REFRESH_COOKIE_NAME, cookieOptions('/'));
};

/**
 * Set HTTP-only secure refresh token cookie for Therapists
 */
export const setTherapistRefreshCookie = (res, token) => {
  res.cookie(THERAPIST_REFRESH_COOKIE_NAME, token, cookieOptions('/'));
};

export const clearTherapistRefreshCookie = (res) => {
  res.clearCookie(THERAPIST_REFRESH_COOKIE_NAME, cookieOptions('/'));
};
