import express from 'express';
import {
  createBooking,
  getMyBookings,
  updateBookingStatus,
} from '../controllers/bookingController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/', createBooking);
router.get('/my-bookings', getMyBookings);
router.patch('/:id/status', updateBookingStatus);

export default router;
