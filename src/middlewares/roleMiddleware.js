exports.authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    try {
      // user protect middleware se aayega
      if (!req.user) {
        return res.status(401).json({
          message: "Not authenticated",
        });
      }

      // role check
      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
          message: "Access denied: insufficient permissions",
        });
      }

      next();
    } catch (error) {
      res.status(500).json({
        message: error.message,
      });
    }
  };
};