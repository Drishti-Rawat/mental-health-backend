import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Please provide a valid email address',
      ],
    },
    passwordHash: {
      type: String,
      default: '',
      select: false,
    },
    role: {
      type: String,
      enum: {
        values: ['user', 'therapist'],
        message: '{VALUE} is not a valid role. Allowed roles: user, therapist',
      },
      default: 'user',
    },
    status: {
      type: String,
      enum: {
        values: ['pending_approval', 'approved', 'active', 'inactive', 'rejected'],
        message: '{VALUE} is not a valid status. Allowed status: pending_approval, approved, active, inactive, rejected',
      },
      default: 'active',
    },
  },
  {
    timestamps: true,
  }
);

// Instance method to compare password with passwordHash
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.passwordHash) return false;
  return await bcrypt.compare(candidatePassword, this.passwordHash);
};

const User = mongoose.model('User', userSchema);

export default User;
