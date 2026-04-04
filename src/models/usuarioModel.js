const db = require('../config/database');

const UsuarioModel = {

  // Buscar usuario por email
  findByEmail: async (email) => {
    const [rows] = await db.execute(
      'SELECT * FROM usuarios WHERE email = ? AND activo = 1',
      [email]
    );
    return rows[0] || null;
  },

  // Buscar usuario por ID
  findById: async (id) => {
    const [rows] = await db.execute(
      'SELECT id, nombre, email, rol FROM usuarios WHERE id = ? AND activo = 1',
      [id]
    );
    return rows[0] || null;
  },

  // Actualizar contraseña
  updatePassword: async (id, passwordHash) => {
    await db.execute(
      'UPDATE usuarios SET password_hash = ? WHERE id = ?',
      [passwordHash, id]
    );
  }
};

module.exports = UsuarioModel;