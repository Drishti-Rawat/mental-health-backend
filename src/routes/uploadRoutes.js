import express from 'express';
import { uploadSingleImage } from '../middleware/uploadMiddleware.js';
import { uploadStreamToCloudinary } from '../config/cloudinary.js';
import { uploadLimiter } from '../middleware/rateLimitMiddleware.js';

const router = express.Router();

/**
 * @desc    Upload single image to Cloudinary & return permanent HTTPS URL
 * @route   POST /api/upload/image
 * @access  Public / Protected
 */
router.post('/image', uploadLimiter, (req, res, next) => {
  uploadSingleImage(req, res, async (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message || 'Image upload failed',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided in request body (field: image)',
      });
    }

    try {
      const folder = req.query.folder || 'blogs';
      const imageUrl = await uploadStreamToCloudinary(req.file.buffer, folder, req.file.mimetype);

      res.status(200).json({
        success: true,
        message: 'Image uploaded successfully to Cloudinary',
        url: imageUrl,
        imageUrl,
      });
    } catch (uploadErr) {
      next(uploadErr);
    }
  });
});

export default router;
