const db = require('../config/database');

const SorteoModel = {

  // Obtener todos los sorteos
  getAll: async () => {
    const [rows] = await db.execute(
      `SELECT s.*, u.nombre as creado_por
       FROM sorteos s
       LEFT JOIN usuarios u ON s.created_by = u.id
       ORDER BY s.created_at DESC`
    );
    return rows;
  },

  // Obtener sorteos activos (página pública)
  getActivos: async () => {
    const [rows] = await db.execute(
      `SELECT id, nombre, descripcion, boleto_inicio, boleto_fin,
              precio_boleto, moneda, premio_descripcion, premio_monto,
              premio_moneda, fecha_sorteo, youtube_link, folio_segob
       FROM sorteos WHERE estado = 'activo'
       ORDER BY created_at DESC`
    );
    return rows;
  },

  // Obtener un sorteo por ID
  findById: async (id) => {
    const [rows] = await db.execute(
      'SELECT * FROM sorteos WHERE id = ?',
      [id]
    );
    return rows[0] || null;
  },

  // Contar sorteos activos
  countActivos: async () => {
    const [rows] = await db.execute(
      'SELECT COUNT(*) as total FROM sorteos WHERE estado = "activo"'
    );
    return rows[0].total;
  },

  // Crear sorteo
create: async (data) => {
  const [result] = await db.execute(
    `INSERT INTO sorteos
      (nombre, descripcion, boleto_inicio, boleto_fin, precio_boleto,
       moneda, premio_descripcion, premio_monto, premio_moneda,
       fecha_sorteo, youtube_link, folio_segob, estado, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'borrador', ?)`,
    [
      data.nombre,
      data.descripcion       || null,
      data.boleto_inicio,
      data.boleto_fin,
      data.precio_boleto,
      data.moneda            || 'MXN',
      data.premio_descripcion|| null,
      data.premio_monto      || null,
      data.premio_moneda     || 'MXN',
      data.fecha_sorteo      || null,
      data.youtube_link      || null,
      data.folio_segob       || null,
      data.created_by
    ]
  );
  return result.insertId;
},

  // Activar sorteo
  activar: async (id) => {
    await db.execute(
      'UPDATE sorteos SET estado = "activo" WHERE id = ? AND estado = "borrador"',
      [id]
    );
  },

  // Cerrar sorteo
  cerrar: async (id) => {
    await db.execute(
      'UPDATE sorteos SET estado = "cerrado" WHERE id = ?',
      [id]
    );
  },

  // Cancelar sorteo
  cancelar: async (id) => {
    await db.execute(
      'UPDATE sorteos SET estado = "cancelado" WHERE id = ?',
      [id]
    );
  },

  // Verificar si tiene boletos vendidos
  tieneBoletos: async (id) => {
    const [rows] = await db.execute(
      'SELECT COUNT(*) as total FROM boletos WHERE sorteo_id = ? AND estado IN ("vendido","reservado")',
      [id]
    );
    return rows[0].total > 0;
  },

  // Actualizar YouTube link
  updateYoutube: async (id, link) => {
    await db.execute(
      'UPDATE sorteos SET youtube_link = ? WHERE id = ?',
      [link, id]
    );
  }
};

module.exports = SorteoModel;