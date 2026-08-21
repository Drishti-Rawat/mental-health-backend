import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import Psychologist from '../models/Psychologist.js';
import User from '../models/User.js';

/**
 * @desc    Create a new session booking
 * @route   POST /api/bookings
 * @access  Public / Patient
 */
export const createBooking = async (req, res, next) => {
  try {
    const {
      patientId,
      patientName,
      patientEmail,
      therapistId,
      therapistName,
      date,
      slot,
      type,
      topic,
    } = req.body;

    if (!therapistId || !date || !slot || !topic) {
      return res.status(400).json({
        success: false,
        message: 'Therapist ID, date, time slot, and consultation topic are required.',
      });
    }

    // Check if slot is already booked for this therapist on date
    const existingConflict = await Booking.findOne({
      therapistId,
      date,
      slot,
      status: { $ne: 'Rejected' },
    });

    if (existingConflict) {
      return res.status(400).json({
        success: false,
        message: `The slot "${slot}" on ${date} has already been reserved. Please select another slot.`,
      });
    }

    // Attempt resolving User & Psychologist object IDs if logged in
    let patientRef = null;
    let therapistRef = null;

    if (req.user) {
      patientRef = req.user.id;
    }

    if (therapistId && mongoose.Types.ObjectId.isValid(therapistId)) {
      therapistRef = therapistId;
    }

    const booking = await Booking.create({
      patient: patientRef,
      patientName: patientName || req.user?.name || 'Patient Client',
      patientEmail: (patientEmail || req.user?.email || '').toLowerCase(),
      therapist: therapistRef,
      therapistId,
      therapistName: therapistName || 'Practitioner',
      date,
      slot,
      type: type || 'Video Consultation',
      topic: topic.trim(),
      status: 'Pending',
    });

    res.status(201).json({
      success: true,
      message: 'Session booking request created successfully!',
      booking,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get bookings for logged-in user or by email query
 * @route   GET /api/bookings/my-bookings
 * @access  Public / Protected
 */
export const getMyBookings = async (req, res, next) => {
  try {
    const userEmail = req.query.email || req.user?.email;
    const userId = req.user?.id;
    const role = req.user?.role;

    let query = {};

    if (role === 'therapist') {
      // Find therapist profile to get ID
      const psychProfile = await Psychologist.findOne({ $or: [{ user: userId }, { email: userEmail?.toLowerCase() }] });
      const pId = psychProfile ? psychProfile._id.toString() : userId;

      query = {
        $or: [
          { therapistId: pId },
          { therapistId: userId },
          { therapist: userId },
          { therapistName: { $regex: req.user?.name || '', $options: 'i' } },
        ],
      };
    } else if (userEmail) {
      query = {
        $or: [
          { patientEmail: userEmail.toLowerCase() },
          { patient: userId },
        ],
      };
    }

    const bookings = await Booking.find(query).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: bookings.length,
      bookings,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update booking status (Accept -> Confirmed, Reject -> Rejected, Complete -> Completed)
 * @route   PATCH /api/bookings/:id/status
 * @access  Private / Therapist / Admin
 */
export const updateBookingStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['Pending', 'Confirmed', 'Rejected', 'Completed'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value. Allowed: Pending, Confirmed, Rejected, Completed',
      });
    }

    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking record not found',
      });
    }

    booking.status = status;
    await booking.save();

    res.status(200).json({
      success: true,
      message: `Booking status updated to ${status}`,
      booking,
    });
  } catch (error) {
    next(error);
  }
};
