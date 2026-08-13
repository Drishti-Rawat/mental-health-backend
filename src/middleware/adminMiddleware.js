export const admin = (req, res, next) => {
  const allowedAdminRoles = ['superadmin', 'admin', 'supervisor'];
  if (req.user && allowedAdminRoles.includes(req.user.role)) {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: 'Forbidden: Administrative privilege required',
    });
  }
};

export const superAdminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'superadmin') {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: 'Forbidden: Superadmin privilege required',
    });
  }
};
