import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Upload a file buffer strictly to Cloudinary & return the HTTPS CDN URL
 * @param {Buffer} fileBuffer - File buffer from multer memoryStorage
 * @param {string} folder - Destination folder name in Cloudinary (e.g., 'blogs')
 * @param {string} mimeType - File MIME type (e.g. 'image/png')
 * @returns {Promise<string>} - Returns the secure HTTPS Cloudinary URL
 */
export const uploadStreamToCloudinary = async (fileBuffer, folder = 'blogs', mimeType = 'image/jpeg') => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

  if (!cloudName || !apiKey || !apiSecret || cloudName === 'your_cloud_name') {
    throw new Error('Cloudinary credentials (CLOUDINARY_CLOUD_NAME, API_KEY, API_SECRET) are missing or invalid in backend .env!');
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });

  const b64 = Buffer.from(fileBuffer).toString('base64');
  const dataURI = `data:${mimeType || 'image/jpeg'};base64,${b64}`;

  const result = await cloudinary.uploader.upload(dataURI, {
    folder: `mental_health/${folder}`,
    resource_type: 'auto',
  });

  return result.secure_url;
};

export default cloudinary;
