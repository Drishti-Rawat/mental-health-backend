import User from '../models/User.js';
import Admin from '../models/Admin.js';
import { verifyAccessToken } from '../utils/jwt.js';

export const protect = async (req, res, next) => {
  try {
    let token;

    // Read Bearer token from Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized: Access token missing',
      });
    }

    // Verify JWT access token
    const decoded = verifyAccessToken(token);

    // Look up in Admin collection first, then User collection
    let account = await Admin.findById(decoded.sub);
    let accountType = 'Admin';

    if (!account) {
      account = await User.findById(decoded.sub);
      accountType = 'User';
    }

    if (!account) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized: Account no longer exists',
      });
    }

    if (account.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Account is inactive or pending approval',
      });
    }

    // Attach user/admin information to request object
    req.user = {
      id: account._id.toString(),
      role: account.role,
      email: account.email,
      accountType,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized: Token invalid or expired',
    });
  }
};
