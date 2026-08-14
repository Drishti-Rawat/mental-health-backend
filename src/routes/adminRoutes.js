import express from 'express';
import {
  registerAdmin,
  loginAdmin,
  refreshAdmin,
  logoutAdmin,
  getPendingStaff,
  approveStaff,
  rejectStaff,
  getAllUsers,
  getUserDetails,
  updateUserStatus,
  deleteUser,
} from '../controllers/adminController.js';
import { protect } from '../middleware/authMiddleware.js';
import { admin } from '../middleware/adminMiddleware.js';

const router = express.Router();

// Public Admin Auth Routes
router.post('/auth/register', registerAdmin);
router.post('/auth/login', loginAdmin);
router.post('/auth/refresh', refreshAdmin);
router.post('/auth/logout', logoutAdmin);

// Protected Admin Management Routes (Requires authentication + admin/supervisor/superadmin role)
router.use(protect, admin);

router.get('/staff/pending', getPendingStaff);
router.patch('/staff/:id/approve', approveStaff);
router.patch('/staff/:id/reject', rejectStaff);

// User Management Routes
router.get('/users', getAllUsers);
router.get('/users/:id', getUserDetails);
router.patch('/users/:id/status', updateUserStatus);
router.delete('/users/:id', deleteUser);

export default router;
