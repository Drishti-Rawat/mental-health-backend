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

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/therapist-login', therapistLogin);
router.post('/refresh', refresh);
router.post('/logout', logout);

// Magic Link invitation endpoints
router.get('/verify-invite-token', verifyInviteToken);
router.post('/set-password-with-token', setPasswordWithToken);

// Protected routes
router.get('/me', protect, me);

export default router;
