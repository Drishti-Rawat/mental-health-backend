import * as adminService from '../services/adminService.js';
import * as authService from '../services/authService.js';
import User from '../models/User.js';
import Admin from '../models/Admin.js';
import AuthSession from '../models/AuthSession.js';
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
 * @desc    Get pending staff applications (Therapists, Admins, Supervisors)
 * @route   GET /api/admin/staff/pending
 * @access  Private/Admin
 */
export const getPendingStaff = async (req, res, next) => {
  try {
    const pendingUsers = await User.find({ status: 'pending_approval' }).select('-passwordHash');
    const pendingAdmins = await Admin.find({ status: 'pending_approval' }).select('-passwordHash');

    res.status(200).json({
      success: true,
      count: pendingUsers.length + pendingAdmins.length,
      pendingTherapists: pendingUsers,
      pendingAdmins,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Approve a pending staff or admin account
 * @route   PATCH /api/admin/staff/:id/approve
 * @access  Private/Admin
 */
export const approveStaff = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check Admin collection first
    let account = await Admin.findById(id);
    let type = 'Admin';

    if (account) {
      account.status = 'active';
      account.approvedBy = req.user.id;
      await account.save();
    } else {
      account = await User.findById(id);
      type = 'User';
      if (!account) {
        return res.status(404).json({ success: false, message: 'Account not found' });
      }
      account.status = 'active';
      await account.save();
    }

    res.status(200).json({
      success: true,
      message: `Successfully approved ${account.role} account for ${account.name}`,
      account: {
        id: account._id,
        name: account.name,
        email: account.email,
        role: account.role,
        status: account.status,
        type,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Reject a pending staff or admin account
 * @route   PATCH /api/admin/staff/:id/reject
 * @access  Private/Admin
 */
export const rejectStaff = async (req, res, next) => {
  try {
    const { id } = req.params;

    let account = await Admin.findById(id);
    if (account) {
      account.status = 'rejected';
      await account.save();
    } else {
      account = await User.findById(id);
      if (!account) {
        return res.status(404).json({ success: false, message: 'Account not found' });
      }
      account.status = 'rejected';
      await account.save();
    }

    // Revoke any active sessions
    await AuthSession.updateMany(
      { userId: account._id, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );

    res.status(200).json({
      success: true,
      message: `Account for ${account.name} rejected`,
      account: {
        id: account._id,
        name: account.name,
        email: account.email,
        role: account.role,
        status: account.status,
      },
    });
  } catch (error) {
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

    // Force query role = 'user' (Patients only). Therapists are managed in Psychologists console.
    const query = { role: 'user' };

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

    const totalCount = await User.countDocuments({ role: 'user' });
    const activeCount = await User.countDocuments({ role: 'user', status: 'active' });
    const inactiveCount = await User.countDocuments({ role: 'user', status: { $ne: 'active' } });

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
        total: totalCount,
        patients: totalCount,
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
