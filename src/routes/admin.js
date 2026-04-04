const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/adminController');
const { authMiddleware } = require('../middlewares/auth');

// Middleware para verificar sesión en vistas
const checkAdmin = (req, res, next) => {
  const token = req.cookies?.token
    || req.headers.authorization?.split(' ')[1];

  if (!token) return res.redirect('/admin/login');

  try {
    const jwt     = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.adminUser = decoded;
    next();
  } catch {
    res.clearCookie('token');
    res.redirect('/admin/login');
  }
};

// Rutas públicas
router.get('/login',  ctrl.loginPage);
router.get('/logout', ctrl.logout);

// Rutas protegidas
router.get('/',                    checkAdmin, (req,res) => res.redirect('/admin/dashboard'));
router.get('/dashboard',           checkAdmin, ctrl.dashboard);
router.get('/sorteos',             checkAdmin, ctrl.sorteos);
router.get('/sorteos/:id',         checkAdmin, ctrl.sorteoDetalle);
router.get('/participantes',       checkAdmin, ctrl.participantes);
router.get('/ganadores',           checkAdmin, ctrl.ganadores);
router.get('/verificar-pin',       checkAdmin, ctrl.verificarPin);
router.get('/configuracion',       checkAdmin, ctrl.configuracion);

// API para guardar configuración
router.post('/api/configuracion', checkAdmin, async (req, res) => {
  try {
    const db = require('../config/database');
    const campos = req.body;
    for (const [clave, valor] of Object.entries(campos)) {
      await db.execute(
        'UPDATE configuracion SET valor = ? WHERE clave = ?',
        [valor, clave]
      );
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error guardando configuración' });
  }
});

module.exports = router;