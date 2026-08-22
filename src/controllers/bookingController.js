import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import Psychologist from '../models/Psychologist.js';
import User from '../models/User.js';

/**
 * Helper to check if a date + time slot is in the past
 */
export const isSlotInPast = (dateStr, slotStr) => {
  if (!dateStr || !slotStr) return false;

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  if (dateStr < todayStr) return true;
  if (dateStr > todayStr) return false;

  const match = slotStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return false;

  let [, hoursStr, minsStr, ampm] = match;
  let hours = parseInt(hoursStr, 10);
  const minutes = parseInt(minsStr, 10);

  if (ampm) {
    ampm = ampm.toUpperCase();
    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
  }

  const slotDate = new Date(now);
  slotDate.setHours(hours, minutes, 0, 0);

  return slotDate <= now;
};

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

    // Check if date/time slot has already passed
    if (isSlotInPast(date, slot)) {
      return res.status(400).json({
        success: false,
        message: `The time slot "${slot}" on ${date} has already passed. Please select an upcoming slot.`,
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
 * @desc    Get bookings for logged-in user (patient or therapist)
 * @route   GET /api/bookings/my-bookings
 * @access  Private / Protected
 */
export const getMyBookings = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const userEmail = req.user?.email?.toLowerCase();
    const role = req.user?.role;

    let query = {};

    if (role === 'therapist') {
      // Find therapist profile linked to this authenticated user
      const psychProfile = await Psychologist.findOne({
        $or: [{ user: userId }, { email: userEmail }],
      });

      const pId = psychProfile ? psychProfile._id.toString() : userId;

      // Strict therapist data isolation: Only return bookings assigned to this specific therapist
      query = {
        $or: [
          { therapistId: pId },
          { therapistId: userId },
          { therapist: userId },
        ],
      };
    } else {
      // Patient user: Only return bookings for this specific patient
      query = {
        $or: [
          { patientEmail: userEmail },
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

    // Verify ownership: Ensure therapist modifying this booking is the assigned therapist or admin
    const userId = req.user?.id;
    const userEmail = req.user?.email?.toLowerCase();
    const isAdmin = req.user?.role === 'admin' || req.user?.accountType === 'Admin';

    if (!isAdmin) {
      const psychProfile = await Psychologist.findOne({
        $or: [{ user: userId }, { email: userEmail }],
      });
      const pId = psychProfile ? psychProfile._id.toString() : userId;

      const isAssignedTherapist =
        booking.therapistId === pId ||
        booking.therapistId === userId ||
        (booking.therapist && booking.therapist.toString() === userId);

      if (!isAssignedTherapist) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: You do not have permission to modify another therapist’s booking.',
        });
      }
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
