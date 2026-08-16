import express from 'express';
import {
  register,
  login,
  therapistLogin,
  refresh,
  logout,
  me,
  verifyInviteToken,
  setPasswordWithToken,
} from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import { authLimiter } from '../middleware/rateLimitMiddleware.js';

const router = express.Router();

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/therapist-login', authLimiter, therapistLogin);
router.post('/refresh', refresh);
router.post('/logout', logout);

// Magic Link invitation endpoints
router.get('/verify-invite-token', verifyInviteToken);
router.post('/set-password-with-token', authLimiter, setPasswordWithToken);

// Protected routes
router.get('/me', protect, me);

export default router;
