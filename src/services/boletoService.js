const db = require('../config/database');

const BoletoService = {

  // Generar todos los boletos de un sorteo al activarlo
  generarBoletos: async (sorteoId, inicio, fin) => {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      // Calcular cantidad de dígitos para formato
      const digitos = String(fin).length;
      const boletos = [];

      for (let i = inicio; i <= fin; i++) {
        // Formatear número con ceros a la izquierda (ej: 0001, 0042)
        const numero = String(i).padStart(digitos, '0');
        boletos.push([sorteoId, numero, 'disponible']);
      }

      // Insertar en lotes de 500 para mejor rendimiento
      const loteSize = 500;
      for (let i = 0; i < boletos.length; i += loteSize) {
        const lote = boletos.slice(i, i + loteSize);
        const placeholders = lote.map(() => '(?, ?, ?)').join(',');
        const valores = lote.flat();
        await conn.execute(
          `INSERT IGNORE INTO boletos (sorteo_id, numero, estado)
           VALUES ${placeholders}`,
          valores
        );
      }

      await conn.commit();
      console.log(`✅ ${boletos.length} boletos generados para sorteo ${sorteoId}`);
      return boletos.length;

    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  // Liberar reservas expiradas (cron job)
  liberarExpiradas: async () => {
    const conn = await db.getConnection();
    try {
      // Obtener reservas expiradas activas
      const [reservas] = await conn.execute(
        `SELECT id, sorteo_id, boletos_json FROM reservas
         WHERE estado = 'activa' AND expira_at < NOW()`
      );

      if (reservas.length === 0) return 0;

      await conn.beginTransaction();

      for (const reserva of reservas) {
        const numeros = JSON.parse(reserva.boletos_json);

        // Liberar boletos
        const placeholders = numeros.map(() => '?').join(',');
        await conn.execute(
          `UPDATE boletos SET estado = 'disponible'
           WHERE sorteo_id = ? AND numero IN (${placeholders})
           AND estado = 'reservado'`,
          [reserva.sorteo_id, ...numeros]
        );

        // Marcar reserva como expirada
        await conn.execute(
          `UPDATE reservas SET estado = 'expirada' WHERE id = ?`,
          [reserva.id]
        );
      }

      await conn.commit();
      console.log(`🔄 ${reservas.length} reservas expiradas liberadas`);
      return reservas.length;

    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }
};

module.exports = BoletoService;