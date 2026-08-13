import * as adminService from '../services/adminService.js';
import User from '../models/User.js';
import Admin from '../models/Admin.js';
import AuthSession from '../models/AuthSession.js';
import { setRefreshCookie } from '../utils/cookie.js';

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

    setRefreshCookie(res, refreshToken);

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
