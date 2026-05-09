const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authMiddleware } = require('../middlewares/auth');
const rateLimit = require('express-rate-limit');
const ResetService = require('../services/resetService');
const EmailService = require('../services/emailService');
const UsuarioModel = require('../models/usuarioModel');
const { hashPassword, verifyPassword } = require('../utils/helpers');

// ── RATE LIMITERS ──
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Demasiados intentos. Espera 15 minutos e intenta de nuevo.' },
  validate: { xForwardedForHeader: false }
});

const recuperarLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { error: 'Demasiados intentos. Espera 1 hora e intenta de nuevo.' },
  validate: false
});

// ── RECUPERACIÓN DE CONTRASEÑA ──

// Solicitar código
router.post('/recuperar/solicitar', recuperarLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email requerido' });

    const usuario = await UsuarioModel.findByEmail(email);

    // Siempre responder igual para no revelar si el email existe
    if (!usuario) {
      return res.json({ ok: true, mensaje: 'Si el correo existe recibirás un código' });
    }

    const codigo = await ResetService.generarCodigo(email);

    await EmailService.enviarCodigoRecuperacion({
      email,
      nombre: usuario.nombre,
      codigo
    });

    return res.json({ ok: true, mensaje: 'Código enviado a tu correo' });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error enviando código' });
  }
});

// Verificar código
router.post('/recuperar/verificar', async (req, res) => {
  try {
    const { email, codigo } = req.body;
    if (!email || !codigo) {
      return res.status(400).json({ error: 'Email y código requeridos' });
    }

    const reset = await ResetService.verificarCodigo(email, codigo);
    if (!reset) {
      return res.status(400).json({ error: 'Código inválido o expirado' });
    }

    return res.json({ ok: true, mensaje: 'Código válido' });

  } catch (err) {
    return res.status(500).json({ error: 'Error verificando código' });
  }
});

// Cambiar contraseña con código
router.post('/recuperar/cambiar', async (req, res) => {
  try {
    const { email, codigo, password } = req.body;

    // Validar contraseña segura
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[#$%.@¡?!])[A-Za-z\d#$%.@¡?!]{8,}$/;
    if (!regex.test(password)) {
      return res.status(400).json({
        error: 'La contraseña debe tener mínimo 8 caracteres, una mayúscula, una minúscula, un número y un carácter especial (#$%.@¡?!)'
      });
    }

    const reset = await ResetService.verificarCodigo(email, codigo);
    if (!reset) {
      return res.status(400).json({ error: 'Código inválido o expirado' });
    }

    const usuario = await UsuarioModel.findByEmail(email);
    const hash = await hashPassword(password);
    await UsuarioModel.updatePassword(usuario.id, hash);
    await ResetService.marcarUsado(reset.id);

    return res.json({ ok: true, mensaje: 'Contraseña actualizada correctamente' });

  } catch (err) {
    return res.status(500).json({ error: 'Error actualizando contraseña' });
  }
});

// ── MI PERFIL ──
router.post('/perfil/cambiar-password', authMiddleware, async (req, res) => {
  try {
    const { passwordActual, passwordNueva } = req.body;

    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[#$%.@¡?!])[A-Za-z\d#$%.@¡?!]{8,}$/;
    if (!regex.test(passwordNueva)) {
      return res.status(400).json({
        error: 'La contraseña debe tener mínimo 8 caracteres, una mayúscula, una minúscula, un número y un carácter especial (#$%.@¡?!)'
      });
    }

    const usuario = await UsuarioModel.findByEmail(req.usuario.email);
    const valida = await verifyPassword(passwordActual, usuario.password_hash);
    if (!valida) {
      return res.status(401).json({ error: 'Contraseña actual incorrecta' });
    }

    const hash = await hashPassword(passwordNueva);
    await UsuarioModel.updatePassword(usuario.id, hash);

    return res.json({ ok: true, mensaje: 'Contraseña actualizada correctamente' });

  } catch (err) {
    return res.status(500).json({ error: 'Error actualizando contraseña' });
  }
});

router.post('/login', loginLimiter, authController.login);
router.post('/logout', authMiddleware, authController.logout);
router.post('/change-password', authMiddleware, authController.changePassword);
router.get('/me', authMiddleware, authController.me);

module.exports = router;