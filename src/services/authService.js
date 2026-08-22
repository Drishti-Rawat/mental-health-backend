import User from '../models/User.js';
import Admin from '../models/Admin.js';
import AuthSession from '../models/AuthSession.js';
import Patient from '../models/Patient.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { generateRandomToken, hashToken } from '../utils/token.js';
import { generateAccessToken } from '../utils/jwt.js';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Register a new user account (Patients are active immediately; Therapists/Admins/Supervisors require approval)
 */
export const registerUser = async ({ name, email, password, role, userAgent, ipAddress }) => {
  const normalizedEmail = email.toLowerCase().trim();

  // Check if email already registered
  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    const error = new Error('A user with this email address already exists');
    error.statusCode = 409;
    throw error;
  }

  // Hash password
  const passwordHash = await hashPassword(password);

  // Validate and assign requested role
  const allowedRoles = ['user', 'therapist', 'supervisor', 'admin'];
  const assignedRole = allowedRoles.includes(role) ? role : 'user';

  // Standard patient/user accounts are active immediately.
  // Staff/Therapist/Supervisor/Admin registration requests require supervisor approval.
  const isPendingApproval = assignedRole !== 'user';
  const initialStatus = isPendingApproval ? 'pending_approval' : 'active';

  const user = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    passwordHash,
    role: assignedRole,
    status: initialStatus,
  });

  // If pending approval, do NOT generate login session or tokens
  if (isPendingApproval) {
    return {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
      },
      isPendingApproval: true,
      accessToken: null,
      refreshToken: null,
    };
  }

  // Create AuthSession for active user (30-day absolute expiration)
  const refreshToken = generateRandomToken();
  const refreshTokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + THIRTY_DAYS_MS);

  await AuthSession.create({
    userId: user._id,
    refreshTokenHash,
    expiresAt,
    userAgent: userAgent || 'Unknown',
    ipAddress: ipAddress || 'Unknown',
  });

  const accessToken = generateAccessToken(user);
  const userObj = await buildUserResponse(user);

  return {
    user: userObj,
    isPendingApproval: false,
    accessToken,
    refreshToken,
  };
};

/**
 * Authenticate user credentials and create a new AuthSession
 */
export const loginUser = async ({ email, password, userAgent, ipAddress }) => {
  const normalizedEmail = email.toLowerCase().trim();

  // Find user in User collection first, then Admin collection
  let user = await User.findOne({ email: normalizedEmail }).select('+passwordHash');
  if (!user) {
    user = await Admin.findOne({ email: normalizedEmail }).select('+passwordHash');
  }

  if (!user) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }

  // Restrict therapists from logging in via standard Patient Login
  if (user.role === 'therapist') {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }

  // Check account status
  if (user.status === 'pending_approval') {
    const error = new Error('Account is pending approval. You cannot log in until approved.');
    error.statusCode = 403;
    throw error;
  }

  if (user.status !== 'active' || !user.passwordHash) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }

  // Verify password
  const isMatch = await comparePassword(password, user.passwordHash);
  if (!isMatch) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }

  // Create new AuthSession
  const refreshToken = generateRandomToken();
  const refreshTokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + THIRTY_DAYS_MS);

  await AuthSession.create({
    userId: user._id,
    refreshTokenHash,
    expiresAt,
    userAgent: userAgent || 'Unknown',
    ipAddress: ipAddress || 'Unknown',
  });

  const accessToken = generateAccessToken(user);
  const userObj = await buildUserResponse(user);

  return {
    user: userObj,
    accessToken,
    refreshToken,
  };
};

/**
 * Dedicated Therapist Clinical Portal Authentication
 */
export const loginTherapist = async ({ email, password, userAgent, ipAddress }) => {
  const normalizedEmail = email.toLowerCase().trim();

  let user = await User.findOne({ email: normalizedEmail }).select('+passwordHash');
  if (!user || user.role !== 'therapist') {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }

  if (user.status === 'pending_approval') {
    const error = new Error('Your therapist account is pending approval.');
    error.statusCode = 403;
    throw error;
  }

  if (user.status !== 'active' || !user.passwordHash) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }

  const isMatch = await comparePassword(password, user.passwordHash);
  if (!isMatch) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }

  const refreshToken = generateRandomToken();
  const refreshTokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + THIRTY_DAYS_MS);

  await AuthSession.create({
    userId: user._id,
    refreshTokenHash,
    expiresAt,
    userAgent: userAgent || 'Unknown',
    ipAddress: ipAddress || 'Unknown',
  });

  const accessToken = generateAccessToken(user);

  return {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
    },
    accessToken,
    refreshToken,
  };
};

/**
 * Refresh access token and perform Refresh Token Rotation
 */
export const refreshSession = async ({ refreshToken, userAgent, ipAddress }) => {
  if (!refreshToken) {
    const error = new Error('Refresh token is required');
    error.statusCode = 401;
    throw error;
  }

  const incomingHash = hashToken(refreshToken);
  const session = await AuthSession.findOne({ refreshTokenHash: incomingHash });

  if (!session) {
    const error = new Error('Invalid or expired refresh token');
    error.statusCode = 401;
    throw error;
  }

  // Token Reuse Detection
  if (session.revokedAt) {
    await AuthSession.updateMany(
      { userId: session.userId, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );
    const error = new Error('Security alert: Refresh token reuse detected. All sessions revoked.');
    error.statusCode = 401;
    throw error;
  }

  // 30-Day Expiration Check
  if (session.expiresAt <= new Date()) {
    session.revokedAt = new Date();
    await session.save();
    const error = new Error('Session has expired after 30 days. Please log in again.');
    error.statusCode = 401;
    throw error;
  }

  // Check User collection first, then Admin collection
  let user = await User.findById(session.userId);
  if (!user) {
    user = await Admin.findById(session.userId);
  }

  if (!user || user.status !== 'active') {
    session.revokedAt = new Date();
    await session.save();
    const error = new Error('User account is inactive or pending approval');
    error.statusCode = 403;
    throw error;
  }

  // Token Rotation
  const newRefreshToken = generateRandomToken();
  session.refreshTokenHash = hashToken(newRefreshToken);
  session.lastUsedAt = new Date();
  if (userAgent) session.userAgent = userAgent;
  if (ipAddress) session.ipAddress = ipAddress;
  await session.save();

  const newAccessToken = generateAccessToken(user);
  const userObj = await buildUserResponse(user);

  return {
    user: userObj,
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
};

/**
 * Revoke specific session on single-device logout
 */
export const logoutSession = async ({ refreshToken }) => {
  if (!refreshToken) return;
  const tokenHash = hashToken(refreshToken);
  await AuthSession.findOneAndUpdate(
    { refreshTokenHash: tokenHash, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
};


/**
 * Helper to build consistent user response with patient profile
 */
export const buildUserResponse = async (user) => {
  let patientProfile = null;
  if (user.role === 'user') {
    patientProfile = await Patient.findOne({ user: user._id });
  }

  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    patientProfile: patientProfile
      ? {
          phone: patientProfile.phone || '',
          dob: patientProfile.dob || '',
          gender: patientProfile.gender || 'Not specified',
          avatarImage: patientProfile.avatarImage || '',
          emergencyContact: {
            name: patientProfile.emergencyContact?.name || '',
            phone: patientProfile.emergencyContact?.phone || '',
          },
          therapyPreferences: {
            preferredFormat: patientProfile.therapyPreferences?.preferredFormat || 'Video Consultation',
            selectedGoals: patientProfile.therapyPreferences?.selectedGoals || [],
            preferredTime: patientProfile.therapyPreferences?.preferredTime || 'Not specified',
          },
          notifications: {
            sessionReminders: patientProfile.notifications?.sessionReminders ?? true,
            emailAlerts: patientProfile.notifications?.emailAlerts ?? true,
            therapistUpdates: patientProfile.notifications?.therapistUpdates ?? true,
            monthlyDigest: patientProfile.notifications?.monthlyDigest ?? false,
          },
        }
      : null,
  };
};

/**
 * Get current authenticated user profile
 */
export const getCurrentUser = async (userId) => {
  const user = await User.findById(userId);
  if (!user || user.status !== 'active') {
    const error = new Error('User not found or inactive');
    error.statusCode = 404;
    throw error;
  }

  return await buildUserResponse(user);
};

/**
 * Update patient profile details in Patient collection
 */
export const updatePatientProfile = async (userId, updateData) => {
  const user = await User.findById(userId);
  if (!user || user.status !== 'active') {
    const error = new Error('User not found or inactive');
    error.statusCode = 404;
    throw error;
  }

  if (updateData.name && updateData.name.trim()) {
    user.name = updateData.name.trim();
    await user.save();
  }

  const patientFields = {
    phone: updateData.phone !== undefined ? updateData.phone : undefined,
    dob: updateData.dob !== undefined ? updateData.dob : undefined,
    gender: updateData.gender !== undefined ? updateData.gender : undefined,
    avatarImage: updateData.avatarImage !== undefined ? updateData.avatarImage : undefined,
    emergencyContact: updateData.emergencyContact !== undefined ? updateData.emergencyContact : undefined,
    therapyPreferences: updateData.therapyPreferences !== undefined ? updateData.therapyPreferences : undefined,
    notifications: updateData.notifications !== undefined ? updateData.notifications : undefined,
  };

  Object.keys(patientFields).forEach((key) => patientFields[key] === undefined && delete patientFields[key]);

  await Patient.findOneAndUpdate(
    { user: user._id },
    { $set: patientFields },
    { new: true, upsert: true, runValidators: true }
  );

  return await buildUserResponse(user);
};

/**
 * Create a new AuthSession directly for a user (e.g. after magic link activation)
 */
export const createSessionForUser = async ({ userId, userAgent, ipAddress }) => {
  const user = await User.findById(userId);
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  const refreshToken = generateRandomToken();
  const refreshTokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + THIRTY_DAYS_MS);

  await AuthSession.create({
    userId: user._id,
    refreshTokenHash,
    expiresAt,
    userAgent: userAgent || 'Unknown',
    ipAddress: ipAddress || 'Unknown',
  });

  const accessToken = generateAccessToken(user);

  return {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
    },
    accessToken,
    refreshToken,
  };
};
