const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/adminController');
const { authMiddleware } = require('../middlewares/auth');
const { upload, uploadGanador, uploadComprobante } = require('../config/upload');
const SorteoModel = require('../models/sorteoModel');
const db = require('../config/database');

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

const { hashPassword } = require('../utils/helpers');
const UsuarioModel = require('../models/usuarioModel');

// Vista usuarios
router.get('/usuarios', checkAdmin, async (req, res) => {
  try {
    const usuarios = await UsuarioModel.getAll();
    res.render('admin/usuarios', {
      title:   'Usuarios',
      page:    'usuarios',
      usuario: req.adminUser,
      scripts: '',
      usuarios
    });
  } catch (err) {
    res.status(500).send('Error cargando usuarios');
  }
});

// API crear usuario
router.post('/api/usuarios', checkAdmin, async (req, res) => {
  try {
    // Solo admin_owner puede crear usuarios
    if (req.adminUser.rol !== 'admin_owner') {
      return res.status(403).json({ error: 'No tienes permisos para crear usuarios' });
    }

    const { nombre, email, telefono, password, rol } = req.body;

    if (!nombre || !email || !password || !rol) {
      return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }

    // Verificar límite de admin_owners
    if (rol === 'admin_owner') {
      const owners = await UsuarioModel.countOwners();
      if (owners >= 2) {
        return res.status(400).json({ error: 'Máximo 2 administradores propietarios permitidos' });
      }
    }

    // Verificar email duplicado
    const existe = await UsuarioModel.findByEmail(email);
    if (existe) {
      return res.status(400).json({ error: 'Este correo ya está registrado' });
    }

    const hash = await hashPassword(password);
    const id   = await UsuarioModel.create({ nombre, email, telefono, password_hash: hash, rol });

    res.status(201).json({ ok: true, id, mensaje: 'Usuario creado correctamente' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error creando usuario' });
  }
});

// API toggle activo
router.patch('/api/usuarios/:id/toggle', checkAdmin, async (req, res) => {
  try {
    if (req.adminUser.rol !== 'admin_owner') {
      return res.status(403).json({ error: 'No tienes permisos' });
    }
    if (req.params.id == req.adminUser.id) {
      return res.status(400).json({ error: 'No puedes desactivar tu propia cuenta' });
    }
    const { activo } = req.body;
    await UsuarioModel.toggleActivo(req.params.id, activo);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error actualizando usuario' });
  }
});

// API cambiar contraseña (admin forzado)
router.patch('/api/usuarios/:id/password', checkAdmin, async (req, res) => {
  try {
    if (req.adminUser.rol !== 'admin_owner') {
      return res.status(403).json({ error: 'No tienes permisos' });
    }
    const { password } = req.body;
    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    }
    const hash = await hashPassword(password);
    await UsuarioModel.updatePassword(req.params.id, hash);
    res.json({ ok: true, mensaje: 'Contraseña actualizada' });
  } catch (err) {
    res.status(500).json({ error: 'Error actualizando contraseña' });
  }
});

// Perfil
router.get('/perfil', checkAdmin, (req, res) => {
  res.render('admin/perfil', {
    title:   'Mi perfil',
    page:    'perfil',
    usuario: req.adminUser,
    scripts: ''
  });
});

// Recuperar contraseña (vista pública)
router.get('/recuperar', (req, res) => {
  res.render('admin/recuperar');
});

// Subir imagen de sorteo
router.post('/api/sorteos/:id/imagen', checkAdmin, upload.single('imagen'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se subió ninguna imagen' });
    }
    const url = `/img/sorteos/${req.file.filename}`;
    await SorteoModel.updateImagen(req.params.id, url);
    res.json({ ok: true, url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error subiendo imagen' });
  }
});

// Buscar boleto por número para registrar ganador
router.get('/api/boletos/buscar', checkAdmin, async (req, res) => {
  try {
    const { sorteo_id, numero } = req.query;
    if (!sorteo_id || !numero) {
      return res.status(400).json({ error: 'Sorteo y número requeridos' });
    }

    const [boletos] = await db.execute(
      `SELECT b.id, b.numero, b.estado, b.pin,
              c.id as comprador_id, c.nombre, c.email, c.telefono
       FROM boletos b
       LEFT JOIN compradores c ON c.id = b.comprador_id
       WHERE b.sorteo_id = ? AND b.numero = ?`,
      [sorteo_id, numero.padStart(4, '0').slice(-String(numero).length)]
    );

    if (boletos.length === 0) {
      return res.status(404).json({ error: 'Boleto no encontrado' });
    }

    return res.json({ ok: true, boleto: boletos[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error buscando boleto' });
  }
});

// Registrar ganador
router.post('/api/ganadores', checkAdmin, async (req, res) => {
  try {
    const { sorteo_id, boleto_id, comprador_id } = req.body;

    if (!sorteo_id || !boleto_id || !comprador_id) {
      return res.status(400).json({ error: 'Faltan datos requeridos' });
    }

    // Verificar que no exista ya un ganador para este sorteo
    const [existe] = await db.execute(
      'SELECT id FROM ganadores WHERE sorteo_id = ?',
      [sorteo_id]
    );
    if (existe.length > 0) {
      return res.status(400).json({ error: 'Este sorteo ya tiene un ganador registrado' });
    }

    await db.execute(
      `INSERT INTO ganadores 
       (sorteo_id, boleto_id, comprador_id, visible_publico)
       VALUES (?, ?, ?, 1)`,
      [sorteo_id, boleto_id, comprador_id]
    );

    // Log
    const Logger = require('../utils/logger');
    await Logger.registrar({
      usuario_id:    req.adminUser.id,
      usuario_email: req.adminUser.email,
      accion:        'GANADOR_REGISTRADO',
      detalle:       `Sorteo ID: ${sorteo_id} — Boleto ID: ${boleto_id}`,
      ip:            req.ip
    });

    res.json({ ok: true, mensaje: 'Ganador registrado correctamente' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error registrando ganador' });
  }
});

// Toggle visible ganador
router.patch('/api/ganadores/:id/visible', checkAdmin, async (req, res) => {
  try {
    const { visible } = req.body;
    await db.execute(
      'UPDATE ganadores SET visible_publico = ? WHERE id = ?',
      [visible, req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error actualizando ganador' });
  }
});

// Marcar premio entregado
router.patch('/api/ganadores/:id/entregado', checkAdmin, async (req, res) => {
  try {
    await db.execute(
      'UPDATE ganadores SET premio_entregado = 1 WHERE id = ?',
      [req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error actualizando ganador' });
  }
});

// Notificar ganador por correo
router.post('/api/ganadores/:id/notificar-email', checkAdmin, async (req, res) => {
  try {
    const [ganadores] = await db.execute(
      `SELECT g.*, c.nombre, c.email, b.numero as boleto_numero,
              s.premio_descripcion
       FROM ganadores g
       JOIN compradores c ON c.id = g.comprador_id
       JOIN boletos b ON b.id = g.boleto_id
       JOIN sorteos s ON s.id = g.sorteo_id
       WHERE g.id = ?`,
      [req.params.id]
    );

    if (ganadores.length === 0) {
      return res.status(404).json({ error: 'Ganador no encontrado' });
    }

    const g = ganadores[0];
    const EmailService = require('../services/emailService');
    await EmailService.enviarNotificacionGanador({
      nombre: g.nombre,
      email:  g.email,
      boleto: g.boleto_numero,
      pin:    req.body.pin,
      premio: g.premio_descripcion
    });

    await db.execute(
      'UPDATE ganadores SET notificado_email = 1 WHERE id = ?',
      [req.params.id]
    );

    res.json({ ok: true, mensaje: 'Correo enviado correctamente' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error enviando correo' });
  }
});

// Subir foto del ganador
router.post('/api/ganadores/:id/foto', checkAdmin, uploadGanador.single('foto'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se subió ninguna imagen' });
    }
    const url = `/img/ganadores/${req.file.filename}`;
    await db.execute(
      'UPDATE ganadores SET foto_url = ? WHERE id = ?',
      [url, req.params.id]
    );
    res.json({ ok: true, url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error subiendo foto' });
  }
});

// Subir comprobante CEP
router.post('/api/ganadores/:id/comprobante', checkAdmin, uploadComprobante.single('comprobante'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se subió ningún archivo' });
    }
    const url  = `/img/ganadores/${req.file.filename}`;
    const tipo = req.file.mimetype === 'application/pdf' ? 'pdf' : 'img';
    await db.execute(
      'UPDATE ganadores SET comprobante_url = ?, comprobante_tipo = ? WHERE id = ?',
      [url, tipo, req.params.id]
    );
    res.json({ ok: true, url, tipo });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error subiendo comprobante' });
  }
});

// Verificar PIN del ganador
router.post('/api/ganadores/verificar-pin', checkAdmin, async (req, res) => {
  try {
    const { ganador_id, pin } = req.body;
    if (!ganador_id || !pin) {
      return res.status(400).json({ error: 'Datos incompletos' });
    }

    const [rows] = await db.execute(
      `SELECT t.pin
       FROM ganadores g
       JOIN boletos b ON b.id = g.boleto_id
       JOIN transacciones t ON t.comprador_id = g.comprador_id
         AND t.sorteo_id = g.sorteo_id
         AND t.estado = 'completada'
       WHERE g.id = ?
       LIMIT 1`,
      [ganador_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Ganador no encontrado' });
    }

    if (rows[0].pin.toUpperCase() !== pin.toUpperCase()) {
      return res.status(400).json({ error: 'PIN incorrecto' });
    }

    await db.execute(
      'UPDATE ganadores SET pin_verificado = 1 WHERE id = ?',
      [ganador_id]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error verificando PIN' });
  }
});

module.exports = router;