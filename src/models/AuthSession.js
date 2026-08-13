import mongoose from 'mongoose';

const authSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, 'User ID is required'],
      refPath: 'userModel',
      index: true,
    },
    userModel: {
      type: String,
      required: true,
      enum: ['User', 'Admin'],
      default: 'User',
    },
    refreshTokenHash: {
      type: String,
      required: [true, 'Refresh token hash is required'],
      index: true,
    },
    expiresAt: {
      type: Date,
      required: [true, 'Expiration date is required'],
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    lastUsedAt: {
      type: Date,
      default: Date.now,
    },
    userAgent: {
      type: String,
      default: 'Unknown',
    },
    ipAddress: {
      type: String,
      default: 'Unknown',
    },
  },
  {
    timestamps: true,
  }
);

// TTL index to clean up expired sessions from DB automatically
authSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const AuthSession = mongoose.model('AuthSession', authSessionSchema);

export default AuthSession;
