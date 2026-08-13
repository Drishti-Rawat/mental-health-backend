import express from 'express';
import {
  register,
  login,
  refresh,
  logout,
  me,
} from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', logout);

// Protected routes
router.get('/me', protect, me);

export default router;
