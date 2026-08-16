import express from 'express';
import {
  registerAdmin,
  loginAdmin,
  refreshAdmin,
  logoutAdmin,
  getAllUsers,
  getUserDetails,
  updateUserStatus,
  deleteUser,
} from '../controllers/adminController.js';
import { protect } from '../middleware/authMiddleware.js';
import { admin } from '../middleware/adminMiddleware.js';
import { authLimiter } from '../middleware/rateLimitMiddleware.js';

const router = express.Router();

// Public Admin Auth Routes
router.post('/auth/register', authLimiter, registerAdmin);
router.post('/auth/login', authLimiter, loginAdmin);
router.post('/auth/refresh', refreshAdmin);
router.post('/auth/logout', logoutAdmin);

// Protected Admin Management Routes (Requires authentication + admin/supervisor/superadmin role)
router.use(protect, admin);

// User Management Routes
router.get('/users', getAllUsers);
router.get('/users/:id', getUserDetails);
router.patch('/users/:id/status', updateUserStatus);
router.delete('/users/:id', deleteUser);

export default router;
