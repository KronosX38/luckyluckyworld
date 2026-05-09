const crypto = require('crypto');
const db = require('../config/database');

const ResetService = {

  // Generar código de 6 dígitos
  generarCodigo: async (email) => {
    // Invalidar códigos anteriores
    await db.execute(
      'UPDATE password_resets SET usado = 1 WHERE email = ?',
      [email]
    );

    // Generar código aleatorio de 6 dígitos
    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    const expira = new Date(Date.now() + 15 * 60 * 1000);
    const expiraLocal = new Date(expira.getTime() - (expira.getTimezoneOffset() * 60000));

    await db.execute(
      'INSERT INTO password_resets (email, codigo, expira_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 15 MINUTE))',
      [email, codigo]
    );

    return codigo;
  },

  // Verificar código
  verificarCodigo: async (email, codigo) => {
    const [rows] = await db.execute(
      `SELECT * FROM password_resets
       WHERE email = ? AND codigo = ? AND usado = 0 AND expira_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [email, codigo]
    );
    return rows[0] || null;
  },

  // Marcar código como usado
  marcarUsado: async (id) => {
    await db.execute(
      'UPDATE password_resets SET usado = 1 WHERE id = ?',
      [id]
    );
  }
};

module.exports = ResetService;