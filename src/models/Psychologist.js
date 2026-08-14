import mongoose from 'mongoose';

const psychologistSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Psychologist name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email address is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Please provide a valid email address',
      ],
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    title: {
      type: String,
      required: [true, 'Professional title/role is required'],
      trim: true,
    },
    specialties: {
      type: [String],
      default: [],
    },
    qualifications: {
      type: String,
      trim: true,
      default: '',
    },
    experienceYears: {
      type: Number,
      default: 0,
      min: [0, 'Experience years cannot be negative'],
    },
    consultationFee: {
      type: Number,
      required: [true, 'Consultation fee is required'],
      min: [0, 'Consultation fee cannot be negative'],
    },
    currency: {
      type: String,
      default: 'INR',
    },
    bio: {
      type: String,
      default: '',
      trim: true,
    },
    image: {
      type: String,
      default: '/therapist.png',
    },
    languages: {
      type: [String],
      default: [],
    },
    rating: {
      type: Number,
      default: 4.8,
      min: 1,
      max: 5,
    },
    reviewCount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: {
        values: ['pending_approval', 'approved', 'active', 'inactive', 'rejected'],
        message: '{VALUE} is not a valid status. Allowed: pending_approval, approved, active, inactive, rejected',
      },
      default: 'pending_approval',
    },
    inviteToken: {
      type: String,
      default: null,
    },
    inviteTokenExpires: {
      type: Date,
      default: null,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Virtual or helper formatting if needed
psychologistSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    return ret;
  },
});

const Psychologist = mongoose.model('Psychologist', psychologistSchema);

export default Psychologist;
