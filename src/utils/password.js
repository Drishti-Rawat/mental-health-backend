import bcrypt from 'bcryptjs';

/**
 * Hash plaintext password using bcrypt with 12 salt rounds
 * @param {string} password - Plaintext password
 * @returns {Promise<string>} Password hash
 */
export const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(12);
  return await bcrypt.hash(password, salt);
};

/**
 * Compare plaintext password with stored passwordHash
 * @param {string} password - Plaintext password
 * @param {string} passwordHash - Hashed password from DB
 * @returns {Promise<boolean>} Match boolean
 */
export const comparePassword = async (password, passwordHash) => {
  return await bcrypt.compare(password, passwordHash);
};
