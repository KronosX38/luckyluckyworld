const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/stripeController');
const { authMiddleware } = require('../middlewares/auth');

// Webhook — necesita el body RAW (no parseado)
router.post('/webhook',
  express.raw({ type: 'application/json' }),
  ctrl.webhook
);

// Crear pago
router.post('/crear-pago', ctrl.crearPago);

module.exports = router;