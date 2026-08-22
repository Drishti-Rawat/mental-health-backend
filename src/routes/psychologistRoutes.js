import express from 'express';
import {
  getAllPsychologists,
  getPsychologistById,
  createPsychologist,
  updatePsychologist,
  deletePsychologist,
  getMyPsychologistProfile,
  updateMyPsychologistProfile,
  applyPsychologist,
  approvePsychologist,
  rejectPsychologist,
  getDistinctSpecialties,
} from '../controllers/psychologistController.js';
import { protect } from '../middleware/authMiddleware.js';
import { admin } from '../middleware/adminMiddleware.js';
import { authLimiter } from '../middleware/rateLimitMiddleware.js';

const router = express.Router();

// Public Routes
router.get('/', getAllPsychologists);
router.get('/specialties', getDistinctSpecialties);

// Public Self-Registration Application Route
router.post('/apply', authLimiter, applyPsychologist);

// Therapist Profile Routes (Must be before /:id)
router.get('/me', protect, getMyPsychologistProfile);
router.put('/me', protect, updateMyPsychologistProfile);

router.get('/:id', getPsychologistById);

// Protected Admin / Management Routes
router.post('/', protect, admin, createPsychologist);
router.patch('/:id/approve', protect, admin, approvePsychologist);
router.patch('/:id/reject', protect, admin, rejectPsychologist);
router.put('/:id', protect, admin, updatePsychologist);
router.delete('/:id', protect, admin, deletePsychologist);

export default router;
