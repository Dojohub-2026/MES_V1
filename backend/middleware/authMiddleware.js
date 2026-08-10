const jwt = require('jsonwebtoken');

// No fallback secret here (unlike some other systems that default to a dev
// string) — if JWT_SECRET is ever unset, every token fails verification
// rather than silently accepting one signed with a guessable default.
// External callers (ERP, etc.) must get their token from this server's own
// /api/auth/login; a token signed elsewhere, even with the same claim
// shape, will never verify here unless it was signed with this exact secret.
function authenticateToken(req, res, next) {
  const authorizationHeader = req.headers.authorization;

  if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Missing or invalid authorization token' });
  }

  const token = authorizationHeader.slice(7).trim();

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden: insufficient privileges' });
    }

    return next();
  };
}

module.exports = {
  authenticateToken,
  requireRole,
};