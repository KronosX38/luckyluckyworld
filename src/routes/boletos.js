const express = require('express');
const router  = express.Router({ mergeParams: true });
const ctrl    = require('../controllers/boletoController');
const { authMiddleware } = require('../middlewares/auth');
const rateLimit = require('express-rate-limit');

// Rate limiting para reservas — máximo 10 por hora por IP
const reservaLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: 'Demasiadas reservas. Intenta más tarde.' }
});

// Públicas
router.get('/',                ctrl.getBySorteo);
router.get('/aleatorio',       ctrl.aleatorio);
router.get('/buscar/:numero',  ctrl.buscar);
router.post('/reservar',       reservaLimiter, ctrl.reservar);

// Protegidas
router.get('/stats',           authMiddleware, ctrl.getStats);
router.post('/verificar-pin',  authMiddleware, ctrl.verificarPIN);

module.exports = router;