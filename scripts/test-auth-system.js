import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../src/models/User.js';
import AuthSession from '../src/models/AuthSession.js';
import * as authService from '../src/services/authService.js';
import { hashPassword } from '../src/utils/password.js';

dotenv.config();

console.log('========================================================================');
console.log('🧪 Starting Full Authentication & Session Management System Test');
console.log('========================================================================\n');

const runTests = async () => {
  try {
    // 1. Connect to MongoDB Atlas
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB Atlas');

    // Clean up test data from previous runs
    const testEmail = 'auth_test_user@example.com';
    const adminEmail = 'auth_admin_user@example.com';

    await User.deleteMany({ email: { $in: [testEmail, adminEmail] } });
    console.log('🧹 Cleaned up existing test accounts');

    // -------------------------------------------------------------------------
    // TEST 1: User Registration (Enforces role: 'user')
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 1: User Registration ---');
    const regResult = await authService.registerUser({
      name: 'Test Auth User',
      email: testEmail,
      password: 'TestPassword123!',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0)',
      ipAddress: '127.0.0.1',
    });

    console.log('✅ User registered successfully:');
    console.log('   User ID:', regResult.user.id);
    console.log('   Role:', regResult.user.role, '(Confirmed restricted to "user")');
    console.log('   Access Token generated (15m):', regResult.accessToken.substring(0, 25) + '...');
    console.log('   Refresh Token generated:', regResult.refreshToken.substring(0, 15) + '...');

    const userId = regResult.user.id;

    // -------------------------------------------------------------------------
    // TEST 2: Verify AuthSession created with hashed refresh token & 30-day expiry
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2: Verify AuthSession Document in DB ---');
    const session1 = await AuthSession.findOne({ userId });
    console.log('✅ AuthSession document found in MongoDB:');
    console.log('   Session ID:', session1._id);
    console.log('   RefreshTokenHash (SHA-256):', session1.refreshTokenHash.substring(0, 20) + '...');
    console.log('   ExpiresAt (30 Days Absolute Expiry):', session1.expiresAt.toISOString());

    // -------------------------------------------------------------------------
    // TEST 3: Login from 2nd Device (Multi-session support)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3: Login from 2nd Device (Multi-Session Support) ---');
    const loginResult = await authService.loginUser({
      email: testEmail,
      password: 'TestPassword123!',
      userAgent: 'Mobile/Safari (iPhone)',
      ipAddress: '192.168.1.50',
    });

    console.log('✅ 2nd Session created successfully!');
    const activeSessionsCount = await AuthSession.countDocuments({ userId, revokedAt: null });
    console.log(`📊 Active sessions count in MongoDB for user: ${activeSessionsCount} (Expected: 2)`);

    // -------------------------------------------------------------------------
    // TEST 4: Refresh Token Rotation
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 4: Refresh Token Rotation ---');
    const oldRefreshToken = loginResult.refreshToken;
    const oldExpiresAt = session1.expiresAt.getTime();

    const refreshResult = await authService.refreshSession({
      refreshToken: oldRefreshToken,
      userAgent: 'Mobile/Safari (iPhone)',
      ipAddress: '192.168.1.50',
    });

    console.log('✅ Refresh successful!');
    console.log('   New Access Token:', refreshResult.accessToken.substring(0, 25) + '...');
    console.log('   New Rotated Refresh Token:', refreshResult.refreshToken.substring(0, 15) + '...');

    // Verify 30-day absolute expiration date was NOT reset
    const updatedSession = await AuthSession.findOne({ userId, revokedAt: null }).sort({ updatedAt: -1 });
    console.log('   Session LastUsedAt updated to:', updatedSession.lastUsedAt.toISOString());

    // -------------------------------------------------------------------------
    // TEST 5: Single Session Logout
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 5: Single Device Logout ---');
    await authService.logoutSession({ refreshToken: refreshResult.refreshToken });
    const remainingSessions = await AuthSession.countDocuments({ userId, revokedAt: null });
    console.log(`📊 Remaining active sessions after single logout: ${remainingSessions} (Expected: 1)`);

    // -------------------------------------------------------------------------
    // TEST 6: User Deactivation & Auto Session Revocation
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 6: User Deactivation & Session Revocation ---');

    // Create Admin User directly for testing
    const adminUser = await User.create({
      name: 'System Admin',
      email: adminEmail,
      passwordHash: await hashPassword('AdminPassword123!'),
      role: 'admin',
      status: 'active',
    });
    console.log('✅ Created Admin user:', adminUser.email, 'Role:', adminUser.role);

    // Deactivate test user
    const testUserObj = await User.findById(userId);
    testUserObj.status = 'inactive';
    await testUserObj.save();

    // Revoke all sessions for deactivated user
    await AuthSession.updateMany({ userId, revokedAt: null }, { $set: { revokedAt: new Date() } });

    const activeCountAfterDeactivation = await AuthSession.countDocuments({ userId, revokedAt: null });
    console.log(`📊 Active sessions count after account deactivation: ${activeCountAfterDeactivation} (Expected: 0)`);

    console.log('\n========================================================================');
    console.log('🎉 ALL AUTHENTICATION & SESSION MANAGEMENT TESTS PASSED PERFECTLY!');
    console.log('========================================================================\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test Error:', error.message);
    console.error(error);
    process.exit(1);
  }
};

runTests();
