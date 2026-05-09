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
  },

  // Obtener todos los usuarios
  getAll: async () => {
    const [rows] = await db.execute(
      'SELECT id, nombre, email, telefono, rol, activo, created_at FROM usuarios ORDER BY created_at DESC'
    );
    return rows;
  },

  // Crear usuario
  create: async (data) => {
    const [result] = await db.execute(
      `INSERT INTO usuarios (nombre, email, telefono, password_hash, rol)
     VALUES (?, ?, ?, ?, ?)`,
      [data.nombre, data.email, data.telefono || null, data.password_hash, data.rol]
    );
    return result.insertId;
  },

  // Activar/desactivar usuario
  toggleActivo: async (id, activo) => {
    await db.execute(
      'UPDATE usuarios SET activo = ? WHERE id = ?',
      [activo, id]
    );
  },

  // Contar admin_owners activos
  countOwners: async () => {
    const [rows] = await db.execute(
      'SELECT COUNT(*) as total FROM usuarios WHERE rol = "admin_owner" AND activo = 1'
    );
    return rows[0].total;
  }
};

module.exports = UsuarioModel;

