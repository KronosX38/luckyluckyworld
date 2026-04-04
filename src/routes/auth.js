const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authMiddleware } = require('../middlewares/auth');
const rateLimit = require('express-rate-limit');

// Límite de intentos de login — máximo 5 por 15 minutos
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Demasiados intentos. Espera 15 minutos e intenta de nuevo.' }
});

router.post('/login',           loginLimiter, authController.login);
router.post('/logout',          authMiddleware, authController.logout);
router.post('/change-password', authMiddleware, authController.changePassword);
router.get('/me',               authMiddleware, authController.me);

module.exports = router;