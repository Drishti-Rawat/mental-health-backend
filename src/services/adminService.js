import Admin from '../models/Admin.js';
import AuthSession from '../models/AuthSession.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { generateRandomToken, hashToken } from '../utils/token.js';
import { generateAccessToken } from '../utils/jwt.js';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Public Admin/Supervisor registration application (Always defaults status: 'pending_approval')
 */
export const registerAdmin = async ({ name, email, password, role }) => {
  const normalizedEmail = email.toLowerCase().trim();

  // Check if admin email already exists
  const existingAdmin = await Admin.findOne({ email: normalizedEmail });
  if (existingAdmin) {
    const error = new Error('An administrative account with this email address already exists');
    error.statusCode = 409;
    throw error;
  }

  // Hash password
  const passwordHash = await hashPassword(password);

  // Restrict requested role to admin or supervisor (superadmin cannot be self-requested)
  const allowedRoles = ['admin', 'supervisor'];
  const assignedRole = allowedRoles.includes(role) ? role : 'admin';

  const admin = await Admin.create({
    name: name.trim(),
    email: normalizedEmail,
    passwordHash,
    role: assignedRole,
    status: 'pending_approval', // Always requires Superadmin approval
  });

  return {
    admin: {
      id: admin._id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      status: admin.status,
    },
    message: 'Admin application submitted successfully. Pending Superadmin/Supervisor approval.',
  };
};

/**
 * Authenticate Admin / Supervisor / Superadmin login
 */
export const loginAdmin = async ({ email, password, userAgent, ipAddress }) => {
  const normalizedEmail = email.toLowerCase().trim();

  const admin = await Admin.findOne({ email: normalizedEmail }).select('+passwordHash');
  if (!admin) {
    const error = new Error('Invalid administrative credentials');
    error.statusCode = 401;
    throw error;
  }

  // Check approval status
  if (admin.status === 'pending_approval') {
    const error = new Error('Your administrative registration is pending Superadmin approval before you can log in.');
    error.statusCode = 403;
    throw error;
  }

  if (admin.status === 'rejected') {
    const error = new Error('Your administrative account application was rejected.');
    error.statusCode = 403;
    throw error;
  }

  if (admin.status !== 'active') {
    const error = new Error('Administrative account is deactivated.');
    error.statusCode = 403;
    throw error;
  }

  // Verify password
  const isMatch = await comparePassword(password, admin.passwordHash);
  if (!isMatch) {
    const error = new Error('Invalid administrative credentials');
    error.statusCode = 401;
    throw error;
  }

  // Create AuthSession for Admin
  const refreshToken = generateRandomToken();
  const refreshTokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + THIRTY_DAYS_MS);

  await AuthSession.create({
    userId: admin._id,
    userModel: 'Admin',
    refreshTokenHash,
    expiresAt,
    userAgent: userAgent || 'Unknown',
    ipAddress: ipAddress || 'Unknown',
  });

  const accessToken = generateAccessToken(admin);

  return {
    admin: {
      id: admin._id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      status: admin.status,
      permissions: admin.permissions,
    },
    accessToken,
    refreshToken,
  };
};

/**
 * Get all admin applications pending approval
 */
export const getPendingAdmins = async () => {
  return await Admin.find({ status: 'pending_approval' }).sort({ createdAt: -1 });
};

/**
 * Superadmin approves a pending Admin/Supervisor application
 */
export const approveAdmin = async ({ adminId, superadminId }) => {
  const admin = await Admin.findById(adminId);
  if (!admin) {
    const error = new Error('Admin account not found');
    error.statusCode = 404;
    throw error;
  }

  admin.status = 'active';
  admin.approvedBy = superadminId;
  await admin.save();

  return {
    id: admin._id,
    name: admin.name,
    email: admin.email,
    role: admin.role,
    status: admin.status,
  };
};

/**
 * Reject an admin application
 */
export const rejectAdmin = async ({ adminId }) => {
  const admin = await Admin.findById(adminId);
  if (!admin) {
    const error = new Error('Admin account not found');
    error.statusCode = 404;
    throw error;
  }

  admin.status = 'rejected';
  await admin.save();

  // Revoke any active sessions
  await AuthSession.updateMany(
    { userId: admin._id, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );

  return {
    id: admin._id,
    name: admin.name,
    email: admin.email,
    role: admin.role,
    status: admin.status,
  };
};

/**
 * Helper to seed initial Superadmin account if none exists
 */
export const seedSuperAdmin = async ({ name, email, password }) => {
  const normalizedEmail = email.toLowerCase().trim();
  let superadmin = await Admin.findOne({ email: normalizedEmail });

  if (!superadmin) {
    const passwordHash = await hashPassword(password);
    superadmin = await Admin.create({
      name,
      email: normalizedEmail,
      passwordHash,
      role: 'superadmin',
      status: 'active',
      permissions: ['all'],
    });
    console.log(`[Seed] Created initial Superadmin account: ${email}`);
  }
  return superadmin;
};
