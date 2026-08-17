import express from 'express';
import {
  getAllPsychologists,
  getPsychologistById,
  createPsychologist,
  updatePsychologist,
  deletePsychologist,
  getMyPsychologistProfile,
  applyPsychologist,
  approvePsychologist,
  rejectPsychologist,
} from '../controllers/psychologistController.js';
import { protect } from '../middleware/authMiddleware.js';
import { admin } from '../middleware/adminMiddleware.js';
import { authLimiter, publicPsychologistLimiter } from '../middleware/rateLimitMiddleware.js';

const router = express.Router();

// Public Routes with Rate Limiting
router.get('/', publicPsychologistLimiter, getAllPsychologists);

// Public Self-Registration Application Route
router.post('/apply', authLimiter, applyPsychologist);

// Therapist Profile Route (Must be before /:id)
router.get('/me', protect, getMyPsychologistProfile);

router.get('/:id', getPsychologistById);

// Protected Admin / Management Routes
router.post('/', protect, admin, createPsychologist);
router.patch('/:id/approve', protect, admin, approvePsychologist);
router.patch('/:id/reject', protect, admin, rejectPsychologist);
router.put('/:id', protect, admin, updatePsychologist);
router.delete('/:id', protect, admin, deletePsychologist);

export default router;
