const UsuarioModel = require('../models/usuarioModel');
const { verifyPassword, generateToken, hashPassword } = require('../utils/helpers');

const authController = {

  // Login
  login: async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email y contraseña son requeridos' });
      }

      // Buscar usuario
      const usuario = await UsuarioModel.findByEmail(email);
      if (!usuario) {
        return res.status(401).json({ error: 'Credenciales incorrectas' });
      }

      // Verificar contraseña
      const passwordValida = await verifyPassword(password, usuario.password_hash);
      if (!passwordValida) {
        return res.status(401).json({ error: 'Credenciales incorrectas' });
      }

      // Generar token
      const token = generateToken({
        id:     usuario.id,
        nombre: usuario.nombre,
        email:  usuario.email,
        rol:    usuario.rol
      });

      // Guardar en cookie segura
      res.cookie('token', token, {
        httpOnly: true,
        secure:   process.env.NODE_ENV === 'production',
        maxAge:   8 * 60 * 60 * 1000 // 8 horas
      });

      return res.json({
        ok:      true,
        token,
        usuario: {
          id:     usuario.id,
          nombre: usuario.nombre,
          email:  usuario.email,
          rol:    usuario.rol
        }
      });

    } catch (err) {
      console.error('Error en login:', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // Logout
  logout: (req, res) => {
    res.clearCookie('token');
    return res.json({ ok: true, mensaje: 'Sesión cerrada correctamente' });
  },

  // Cambiar contraseña
  changePassword: async (req, res) => {
    try {
      const { passwordActual, passwordNueva } = req.body;
      const usuario = await UsuarioModel.findByEmail(req.usuario.email);

      const valida = await verifyPassword(passwordActual, usuario.password_hash);
      if (!valida) {
        return res.status(401).json({ error: 'Contraseña actual incorrecta' });
      }

      if (passwordNueva.length < 8) {
        return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres' });
      }

      const hash = await hashPassword(passwordNueva);
      await UsuarioModel.updatePassword(usuario.id, hash);

      return res.json({ ok: true, mensaje: 'Contraseña actualizada correctamente' });

    } catch (err) {
      console.error('Error cambiando contraseña:', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // Verificar sesión activa
  me: async (req, res) => {
    try {
      const usuario = await UsuarioModel.findById(req.usuario.id);
      if (!usuario) {
        return res.status(401).json({ error: 'Usuario no encontrado' });
      }
      return res.json({ ok: true, usuario });
    } catch (err) {
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
};

module.exports = authController;