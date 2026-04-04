const express    = require('express');
const router     = express.Router();
const ctrl       = require('../controllers/sorteoController');
const { authMiddleware, ownerOnly } = require('../middlewares/auth');

// Públicas
router.get('/activos',       ctrl.listarActivos);
router.get('/:id',           ctrl.obtener);

// Protegidas — requieren login
router.get('/',              authMiddleware, ctrl.listar);
router.post('/',             authMiddleware, ctrl.crear);
router.patch('/:id/activar', authMiddleware, ownerOnly, ctrl.activar);
router.patch('/:id/cerrar',  authMiddleware, ctrl.cerrar);
router.patch('/:id/youtube', authMiddleware, ctrl.updateYoutube);

module.exports = router;