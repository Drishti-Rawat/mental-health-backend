import * as authService from '../services/authService.js';
import { setRefreshCookie, clearRefreshCookie } from '../utils/cookie.js';

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public
 */
export const register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required',
      });
    }

    const userAgent = req.headers['user-agent'];
    const ipAddress = req.ip || req.connection.remoteAddress;

    const { user, accessToken, refreshToken } = await authService.registerUser({
      name,
      email,
      password,
      role,
      userAgent,
      ipAddress,
    });

    // Set HTTP-only refresh cookie
    setRefreshCookie(res, refreshToken);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user,
      accessToken,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Login user & create session
 * @route   POST /api/auth/login
 * @access  Public
 */
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    const userAgent = req.headers['user-agent'];
    const ipAddress = req.ip || req.connection.remoteAddress;

    const { user, accessToken, refreshToken } = await authService.loginUser({
      email,
      password,
      userAgent,
      ipAddress,
    });

    // Set HTTP-only refresh cookie
    setRefreshCookie(res, refreshToken);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      user,
      accessToken,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Refresh access token & rotate refresh token
 * @route   POST /api/auth/refresh
 * @access  Public (via HTTP-only cookie)
 */
export const refresh = async (req, res, next) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Authentication failed: Refresh token missing from cookies',
      });
    }

    const userAgent = req.headers['user-agent'];
    const ipAddress = req.ip || req.connection.remoteAddress;

    const { user, accessToken, refreshToken: newRefreshToken } = await authService.refreshSession({
      refreshToken,
      userAgent,
      ipAddress,
    });

    // Rotate HTTP-only refresh cookie
    setRefreshCookie(res, newRefreshToken);

    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      user,
      accessToken,
    });
  } catch (error) {
    clearRefreshCookie(res);
    next(error);
  }
};

/**
 * @desc    Logout current session
 * @route   POST /api/auth/logout
 * @access  Public / Protected
 */
export const logout = async (req, res, next) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (refreshToken) {
      await authService.logoutSession({ refreshToken });
    }
    clearRefreshCookie(res);

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    clearRefreshCookie(res);
    next(error);
  }
};


/**
 * @desc    Get authenticated user profile
 * @route   GET /api/auth/me
 * @access  Protected
 */
export const me = async (req, res, next) => {
  try {
    const user = await authService.getCurrentUser(req.user.id);
    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    next(error);
  }
};
