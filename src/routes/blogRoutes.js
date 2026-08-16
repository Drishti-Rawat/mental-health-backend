import express from 'express';
import {
  getAllBlogs,
  getBlogByIdOrSlug,
  createBlog,
  updateBlog,
  deleteBlog,
} from '../controllers/blogController.js';
import { protect } from '../middleware/authMiddleware.js';
import { admin } from '../middleware/adminMiddleware.js';

const router = express.Router();

// Public Blog Routes
router.get('/', getAllBlogs);
router.get('/:idOrSlug', getBlogByIdOrSlug);

// Protected Admin Management Routes
router.post('/', protect, admin, createBlog);
router.put('/:id', protect, admin, updateBlog);
router.delete('/:id', protect, admin, deleteBlog);

export default router;
