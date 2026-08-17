import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const adminSchema = new mongoose.Schema(
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
      required: [true, 'Password hash is required'],
      select: false,
    },
    role: {
      type: String,
      enum: {
        values: ['superadmin', 'admin', 'supervisor'],
        message: '{VALUE} is not a valid admin role. Allowed: superadmin, admin, supervisor',
      },
      default: 'admin',
    },
    status: {
      type: String,
      enum: {
        values: ['pending_approval', 'approved', 'active', 'inactive', 'rejected'],
        message: '{VALUE} is not a valid status. Allowed: pending_approval, approved, active, inactive, rejected',
      },
      default: 'pending_approval',
    },
    permissions: {
      type: [String],
      default: ['view_dashboard', 'manage_users'],
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Instance method to compare password
adminSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.passwordHash);
};

const Admin = mongoose.model('Admin', adminSchema);

export default Admin;
