import rateLimit from 'express-rate-limit';

/**
 * Strict Auth & Sensitive Action Limiter (Login, Register, Password Reset, Applications)
 * 30 attempts per 15 minutes per IP to protect against brute force
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 auth attempts per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again after 15 minutes.',
  },
});

/**
 * Image Upload Limiter (Cloudinary Image Uploads)
 * 30 image uploads per 15 minutes per IP
 */
export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 image uploads per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Image upload limit exceeded. You can upload up to 30 images per 15 minutes.',
  },
});
