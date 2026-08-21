import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    patientName: {
      type: String,
      required: [true, 'Patient name is required'],
      trim: true,
    },
    patientEmail: {
      type: String,
      required: [true, 'Patient email address is required'],
      lowercase: true,
      trim: true,
    },
    therapist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Psychologist',
      required: false,
    },
    therapistId: {
      type: String,
      required: [true, 'Therapist ID is required'],
    },
    therapistName: {
      type: String,
      required: [true, 'Therapist name is required'],
      trim: true,
    },
    date: {
      type: String,
      required: [true, 'Consultation date is required'],
    },
    slot: {
      type: String,
      required: [true, 'Time slot is required'],
    },
    type: {
      type: String,
      enum: ['Video Consultation', 'Chat Session', 'In-Person'],
      default: 'Video Consultation',
    },
    topic: {
      type: String,
      required: [true, 'Consultation topic/reason is required'],
      trim: true,
    },
    status: {
      type: String,
      enum: ['Pending', 'Confirmed', 'Rejected', 'Completed'],
      default: 'Pending',
    },
  },
  {
    timestamps: true,
  }
);

bookingSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    return ret;
  },
});

const Booking = mongoose.model('Booking', bookingSchema);

export default Booking;
