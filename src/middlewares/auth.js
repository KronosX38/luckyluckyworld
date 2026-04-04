const { verifyToken } = require('../utils/helpers');

// Verificar que el usuario está autenticado
const authMiddleware = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]
      || req.cookies?.token;

    if (!token) {
      return res.status(401).json({ error: 'No autorizado — inicia sesión' });
    }

    const decoded = verifyToken(token);
    req.usuario = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Sesión expirada — inicia sesión nuevamente' });
  }
};

// Verificar que es admin owner
const ownerOnly = (req, res, next) => {
  if (req.usuario.rol !== 'admin_owner') {
    return res.status(403).json({ error: 'Acceso restringido — solo administradores' });
  }
  next();
};

module.exports = { authMiddleware, ownerOnly };