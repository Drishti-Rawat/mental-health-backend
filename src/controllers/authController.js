import * as authService from '../services/authService.js';
import { setRefreshCookie, clearRefreshCookie } from '../utils/cookie.js';
import User from '../models/User.js';
import Psychologist from '../models/Psychologist.js';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

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
 * @desc    Dedicated Therapist Clinical Portal Login
 * @route   POST /api/auth/therapist-login
 * @access  Public
 */
export const therapistLogin = async (req, res, next) => {
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

    const { user, accessToken, refreshToken } = await authService.loginTherapist({
      email,
      password,
      userAgent,
      ipAddress,
    });

    setRefreshCookie(res, refreshToken);

    res.status(200).json({
      success: true,
      message: 'Therapist authentication successful',
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

/**
 * @desc    Verify magic invitation token (queries Psychologist collection)
 * @route   GET /api/auth/verify-invite-token
 * @access  Public
 */
export const verifyInviteToken = async (req, res, next) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Invitation token is required',
      });
    }

    const psychologist = await Psychologist.findOne({
      inviteToken: token,
      inviteTokenExpires: { $gt: new Date() },
    });

    if (!psychologist) {
      return res.status(400).json({
        success: false,
        message: 'Invitation link is invalid or has expired',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Token verified successfully',
      valid: true,
      practitioner: {
        name: psychologist.name,
        email: psychologist.email,
        title: psychologist.title,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Set password using magic token & activate therapist User account
 * @route   POST /api/auth/set-password-with-token
 * @access  Public
 */
export const setPasswordWithToken = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        success: false,
        message: 'Token and password are required',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters',
      });
    }

    const psychologist = await Psychologist.findOne({
      inviteToken: token,
      inviteTokenExpires: { $gt: new Date() },
    });

    if (!psychologist) {
      return res.status(400).json({
        success: false,
        message: 'Invitation link is invalid or has expired',
      });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    let activeUser;

    // Execute atomic transaction for User creation/update + Psychologist status activation
    try {
      session.startTransaction();

      let user = await User.findOne({ email: psychologist.email.toLowerCase() }).session(session);

      if (!user) {
        const [newUser] = await User.create(
          [
            {
              name: psychologist.name,
              email: psychologist.email.toLowerCase(),
              passwordHash,
              role: 'therapist',
              status: 'active',
            },
          ],
          { session }
        );
        user = newUser;
      } else {
        user.passwordHash = passwordHash;
        user.role = 'therapist';
        user.status = 'active';
        await user.save({ session });
      }

      // Activate psychologist & clear invitation token
      psychologist.status = 'active';
      psychologist.user = user._id;
      psychologist.inviteToken = null;
      psychologist.inviteTokenExpires = null;
      await psychologist.save({ session });

      await session.commitTransaction();
      activeUser = user;
    } catch (txError) {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      // If MongoDB standalone instance without replica set, execute sequentially
      if (txError.message && (txError.message.includes('replica set') || txError.message.includes('Transaction numbers'))) {
        let user = await User.findOne({ email: psychologist.email.toLowerCase() });
        if (!user) {
          user = await User.create({
            name: psychologist.name,
            email: psychologist.email.toLowerCase(),
            passwordHash,
            role: 'therapist',
            status: 'active',
          });
        } else {
          user.passwordHash = passwordHash;
          user.role = 'therapist';
          user.status = 'active';
          await user.save();
        }

        psychologist.status = 'active';
        psychologist.user = user._id;
        psychologist.inviteToken = null;
        psychologist.inviteTokenExpires = null;
        await psychologist.save();
        activeUser = user;
      } else {
        throw txError;
      }
    } finally {
      session.endSession();
    }

    const userAgent = req.headers['user-agent'];
    const ipAddress = req.ip || req.connection.remoteAddress;

    const sessionData = await authService.createSessionForUser({
      userId: activeUser._id,
      userAgent,
      ipAddress,
    });

    setRefreshCookie(res, sessionData.refreshToken);

    res.status(200).json({
      success: true,
      message: 'Account activated successfully! You are now logged in.',
      user: sessionData.user,
      accessToken: sessionData.accessToken,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update patient profile details
 * @route   PUT /api/auth/profile
 * @access  Protected
 */
export const updateProfile = async (req, res, next) => {
  try {
    const updatedUser = await authService.updatePatientProfile(req.user.id, req.body);
    res.status(200).json({
      success: true,
      message: 'Profile details updated successfully',
      user: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};
