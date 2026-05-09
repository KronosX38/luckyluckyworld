const db = require('../config/database');

const Logger = {
  registrar: async ({ usuario_id, usuario_email, accion, detalle, ip }) => {
    try {
      await db.execute(
        `INSERT INTO logs_actividad 
         (usuario_id, usuario_email, accion, detalle, ip)
         VALUES (?, ?, ?, ?, ?)`,
        [usuario_id || null, usuario_email || null, accion, detalle || null, ip || null]
      );
    } catch (err) {
      console.error('Error guardando log:', err.message);
    }
  }
};

module.exports = Logger;