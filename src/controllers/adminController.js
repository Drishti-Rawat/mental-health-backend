import * as adminService from '../services/adminService.js';
import * as authService from '../services/authService.js';
import User from '../models/User.js';
import Admin from '../models/Admin.js';
import Psychologist from '../models/Psychologist.js';
import AuthSession from '../models/AuthSession.js';
import { sendTherapistInviteEmail } from '../services/emailService.js';
import crypto from 'crypto';
import { setAdminRefreshCookie, clearAdminRefreshCookie } from '../utils/cookie.js';

/**
 * @desc    Submit Admin / Supervisor application (status = pending_approval)
 * @route   POST /api/admin/auth/register
 * @access  Public
 */
export const registerAdmin = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required',
      });
    }

    const result = await adminService.registerAdmin({ name, email, password, role });
    res.status(201).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Login for Admin / Supervisor / Superadmin
 * @route   POST /api/admin/auth/login
 * @access  Public
 */
export const loginAdmin = async (req, res, next) => {
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

    const { admin, accessToken, refreshToken } = await adminService.loginAdmin({
      email,
      password,
      userAgent,
      ipAddress,
    });

    setAdminRefreshCookie(res, refreshToken);

    res.status(200).json({
      success: true,
      message: 'Admin authentication successful',
      admin,
      accessToken,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Silent refresh for Admin / Supervisor / Superadmin
 * @route   POST /api/admin/auth/refresh
 * @access  Public
 */
export const refreshAdmin = async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.adminRefreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Admin authentication failed: Refresh token missing from cookies',
      });
    }

    const userAgent = req.headers['user-agent'];
    const ipAddress = req.ip || req.connection.remoteAddress;

    const { user: admin, accessToken, refreshToken: newRefreshToken } = await authService.refreshSession({
      refreshToken,
      userAgent,
      ipAddress,
    });

    setAdminRefreshCookie(res, newRefreshToken);

    res.status(200).json({
      success: true,
      message: 'Admin token refreshed successfully',
      admin,
      accessToken,
    });
  } catch (error) {
    clearAdminRefreshCookie(res);
    next(error);
  }
};

/**
 * @desc    Logout Admin session
 * @route   POST /api/admin/auth/logout
 * @access  Public / Protected
 */
export const logoutAdmin = async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.adminRefreshToken;
    if (refreshToken) {
      await authService.revokeSession(refreshToken);
    }
    clearAdminRefreshCookie(res);
    res.status(200).json({
      success: true,
      message: 'Admin logged out successfully',
    });
  } catch (error) {
    clearAdminRefreshCookie(res);
    next(error);
  }
};



/**
 * @desc    Get all registered users with optional search & status filter
 * @route   GET /api/admin/users
 * @access  Private/Admin
 */
export const getAllUsers = async (req, res, next) => {
  try {
    const { search, status } = req.query;

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    // Role filter handling (if role is provided and not 'all', use it; default to 'user' if omitted)
    const query = {};
    if (req.query.role && req.query.role !== 'all') {
      query.role = req.query.role;
    } else if (!req.query.role) {
      query.role = 'user';
    }

    if (status && status !== 'all') {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const filteredTotal = await User.countDocuments(query);
    const usersDocs = await User.find(query)
      .select('-passwordHash')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const users = usersDocs.map((u) => ({
      id: u._id.toString(),
      _id: u._id.toString(),
      name: u.name,
      email: u.email,
      role: u.role,
      status: u.status,
      createdAt: u.createdAt,
    }));

    const totalPages = Math.ceil(filteredTotal / limit) || 1;

    // System stats breakdown strictly from User model
    const totalUsersCount = await User.countDocuments({});
    const patientsCount = await User.countDocuments({ role: 'user' });
    const therapistsCount = await User.countDocuments({ role: 'therapist' });
    const activeCount = await User.countDocuments({ status: 'active' });
    const inactiveCount = await User.countDocuments({ status: { $ne: 'active' } });

    res.status(200).json({
      success: true,
      count: users.length,
      pagination: {
        totalRecords: filteredTotal,
        totalPages,
        currentPage: page,
        limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      stats: {
        total: totalUsersCount,
        patients: patientsCount,
        therapists: therapistsCount,
        active: activeCount,
        inactive: inactiveCount,
      },
      users,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get user profile details by ID
 * @route   GET /api/admin/users/:id
 * @access  Private/Admin
 */
export const getUserDetails = async (req, res, next) => {
  try {
    const { id } = req.params;

    const userDoc = await User.findById(id).select('-passwordHash');
    if (!userDoc) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({
      success: true,
      user: {
        id: userDoc._id,
        _id: userDoc._id,
        name: userDoc.name,
        email: userDoc.email,
        role: userDoc.role,
        status: userDoc.status,
        createdAt: userDoc.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update user status (active, inactive, rejected)
 * @route   PATCH /api/admin/users/:id/status
 * @access  Private/Admin
 */
export const updateUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'inactive', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Allowed: active, inactive, rejected',
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.status = status;
    await user.save();

    // Sync status with Psychologist model if user is a therapist
    if (user.role === 'therapist') {
      await Psychologist.findOneAndUpdate(
        { email: user.email.toLowerCase() },
        { status }
      );
    }

    // Revoke sessions if setting to inactive or rejected
    if (status !== 'active') {
      await AuthSession.updateMany(
        { userId: user._id, revokedAt: null },
        { $set: { revokedAt: new Date() } }
      );
    }

    res.status(200).json({
      success: true,
      message: `User status updated to ${status}`,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete user account
 * @route   DELETE /api/admin/users/:id
 * @access  Private/Admin
 */
export const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.role !== 'user') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete therapist or admin accounts from User Management. ',
      });
    }

    // Revoke all active sessions
    await AuthSession.updateMany(
      { userId: user._id, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );

    await User.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: `User account for ${user.name} has been deleted successfully`,
    });
  } catch (error) {
    next(error);
  }
};
