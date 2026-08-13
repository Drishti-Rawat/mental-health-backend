import express from 'express';
import {
  registerAdmin,
  loginAdmin,
  getPendingStaff,
  approveStaff,
  rejectStaff,
} from '../controllers/adminController.js';
import { protect } from '../middleware/authMiddleware.js';
import { admin } from '../middleware/adminMiddleware.js';

const router = express.Router();

// Public Admin Auth Routes
router.post('/auth/register', registerAdmin);
router.post('/auth/login', loginAdmin);

// Protected Admin Management Routes (Requires authentication + admin/supervisor/superadmin role)
router.use(protect, admin);

router.get('/staff/pending', getPendingStaff);
router.patch('/staff/:id/approve', approveStaff);
router.patch('/staff/:id/reject', rejectStaff);

export default router;
