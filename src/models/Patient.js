import mongoose from 'mongoose';

const patientSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    phone: {
      type: String,
      default: '',
      trim: true,
    },
    dob: {
      type: String,
      default: '',
    },
    gender: {
      type: String,
      default: 'Not specified',
    },
    avatarImage: {
      type: String,
      default: '',
    },
    emergencyContact: {
      name: { type: String, default: '' },
      phone: { type: String, default: '' },
    },
    therapyPreferences: {
      preferredFormat: { type: String, default: 'Video Consultation' },
      selectedGoals: [{ type: String }],
      preferredTime: { type: String, default: 'Not specified' },
    },
    notifications: {
      sessionReminders: { type: Boolean, default: true },
      emailAlerts: { type: Boolean, default: true },
      therapistUpdates: { type: Boolean, default: true },
      monthlyDigest: { type: Boolean, default: false },
    },
  },
  {
    timestamps: true,
  }
);

const Patient = mongoose.model('Patient', patientSchema);

export default Patient;
