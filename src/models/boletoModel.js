const db = require('../config/database');

const BoletoModel = {

  // Obtener todos los boletos de un sorteo
  getBySorteo: async (sorteoId) => {
    const [rows] = await db.execute(
      `SELECT b.numero, b.estado, b.pin,
              c.nombre as comprador_nombre
       FROM boletos b
       LEFT JOIN compradores c ON b.comprador_id = c.id
       WHERE b.sorteo_id = ?
       ORDER BY CAST(b.numero AS UNSIGNED)`,
      [sorteoId]
    );
    return rows;
  },

  // Obtener boletos disponibles
  getDisponibles: async (sorteoId) => {
    const [rows] = await db.execute(
      `SELECT numero FROM boletos
       WHERE sorteo_id = ? AND estado = 'disponible'
       ORDER BY CAST(numero AS UNSIGNED)`,
      [sorteoId]
    );
    return rows.map(r => r.numero);
  },

  // Verificar si un boleto está disponible
  isDisponible: async (sorteoId, numero) => {
    const [rows] = await db.execute(
      `SELECT id FROM boletos
       WHERE sorteo_id = ? AND numero = ? AND estado = 'disponible'`,
      [sorteoId, numero]
    );
    return rows.length > 0;
  },

  // Verificar múltiples boletos disponibles
  checkDisponibles: async (sorteoId, numeros) => {
    const placeholders = numeros.map(() => '?').join(',');
    const [rows] = await db.execute(
      `SELECT numero, estado FROM boletos
       WHERE sorteo_id = ? AND numero IN (${placeholders})`,
      [sorteoId, ...numeros]
    );
    return rows;
  },

  // Reservar boletos (al iniciar pago)
  reservar: async (sorteoId, numeros, reservaId) => {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      for (const numero of numeros) {
        await conn.execute(
          `UPDATE boletos SET estado = 'reservado'
           WHERE sorteo_id = ? AND numero = ? AND estado = 'disponible'`,
          [sorteoId, numero]
        );
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  // Confirmar boletos vendidos (después del pago)
  confirmar: async (sorteoId, numeros, compradorId, pins) => {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      for (let i = 0; i < numeros.length; i++) {
        await conn.execute(
          `UPDATE boletos
           SET estado = 'vendido', comprador_id = ?, pin = ?
           WHERE sorteo_id = ? AND numero = ?`,
          [compradorId, pins[i], sorteoId, numeros[i]]
        );
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  // Liberar boletos reservados (cuando expira reserva)
  liberar: async (sorteoId, numeros) => {
    const placeholders = numeros.map(() => '?').join(',');
    await db.execute(
      `UPDATE boletos SET estado = 'disponible'
       WHERE sorteo_id = ? AND numero IN (${placeholders})
       AND estado = 'reservado'`,
      [sorteoId, ...numeros]
    );
  },

  // Buscar boleto por número
  buscar: async (sorteoId, numero) => {
    const [rows] = await db.execute(
      `SELECT numero, estado FROM boletos
       WHERE sorteo_id = ? AND numero = ?`,
      [sorteoId, numero]
    );
    return rows[0] || null;
  },

  // Verificar PIN del ganador
  verificarPIN: async (sorteoId, pin) => {
    const [rows] = await db.execute(
      `SELECT b.numero, b.pin, b.estado,
              c.nombre, c.email, c.telefono
       FROM boletos b
       LEFT JOIN compradores c ON b.comprador_id = c.id
       WHERE b.sorteo_id = ? AND b.pin = ? AND b.estado = 'vendido'`,
      [sorteoId, pin]
    );
    return rows[0] || null;
  },

  // Estadísticas de un sorteo para el dashboard
  getStats: async (sorteoId) => {
    const [rows] = await db.execute(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN estado = 'disponible' THEN 1 ELSE 0 END) as disponibles,
        SUM(CASE WHEN estado = 'reservado'  THEN 1 ELSE 0 END) as reservados,
        SUM(CASE WHEN estado = 'vendido'    THEN 1 ELSE 0 END) as vendidos,
        SUM(CASE WHEN estado = 'cancelado'  THEN 1 ELSE 0 END) as cancelados
       FROM boletos WHERE sorteo_id = ?`,
      [sorteoId]
    );
    return rows[0];
  }
};

module.exports = BoletoModel;