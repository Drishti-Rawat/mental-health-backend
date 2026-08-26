import cron from 'node-cron';
import { autoRejectPastPendingBookings } from '../controllers/bookingController.js';

/**
/ * Initialize scheduled background cron tasks
/ */
export const initCronJobs = () => {
  console.log('[Cron Service]: Initializing node-cron scheduled tasks...');

  // Run immediate scan on backend startup
  autoRejectPastPendingBookings();

  // Schedule task to run every midnight (00:00)
  cron.schedule('0 0 * * *', () => {
    console.log('[Cron Job - Midnight]: Executing scheduled past pending bookings auto-rejection...');
    autoRejectPastPendingBookings();
  });

  // Schedule periodic hourly check as fallback for daytime expirations
  cron.schedule('0 * * * *', () => {
    autoRejectPastPendingBookings();
  });
};
