const SorteoModel = require('../models/sorteoModel');
const BoletoModel = require('../models/boletoModel');
const db = require('../config/database');

const adminController = {

  // Login page
  loginPage: (req, res) => {
    res.render('admin/login', { error: null });
  },

  // Logout
  logout: (req, res) => {
    res.clearCookie('token');
    res.redirect('/admin/login');
  },

  // Dashboard
  dashboard: async (req, res) => {
    try {
      const sorteos = await SorteoModel.getAll();
      const activos = sorteos.filter(s => s.estado === 'activo');

      // Stats generales
      const [stats] = await db.execute(`
        SELECT
          COUNT(DISTINCT b.comprador_id) as total_compradores,
          SUM(CASE WHEN b.estado = 'vendido' THEN 1 ELSE 0 END) as total_vendidos,
          SUM(CASE WHEN b.estado = 'disponible' THEN 1 ELSE 0 END) as total_disponibles
        FROM boletos b
      `);

      const [ganancias] = await db.execute(`
        SELECT COALESCE(SUM(monto_bruto),0) as bruto,
               COALESCE(SUM(monto_neto),0)  as neto
        FROM transacciones WHERE estado = 'completada'
      `);

      res.render('admin/dashboard', {
        title: 'Dashboard',
        page: 'dashboard',
        usuario: req.adminUser,
        scripts: '',
        sorteos,
        activos,
        stats: stats[0],
        ganancias: ganancias[0]
      });
    } catch (err) {
      console.error(err);
      res.status(500).send('Error cargando dashboard');
    }
  },

  // Sorteos
  sorteos: async (req, res) => {
    try {
      const sorteos = await SorteoModel.getAll();
      res.render('admin/sorteos', {
        title: 'Sorteos',
        page: 'sorteos',
        usuario: req.adminUser,
        scripts: '',
        sorteos
      });
    } catch (err) {
      res.status(500).send('Error cargando sorteos');
    }
  },

  // Detalle de sorteo
  sorteoDetalle: async (req, res) => {
    try {
      const sorteo = await SorteoModel.findById(req.params.id);
      if (!sorteo) return res.redirect('/admin/sorteos');

      const stats = await BoletoModel.getStats(req.params.id);
      const boletos = await BoletoModel.getBySorteo(req.params.id);

      const bruto = stats.vendidos * sorteo.precio_boleto;
      const fee = bruto * 0.036;

      const fmt = (n) => Number(n).toLocaleString('es-MX', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });

      res.render('admin/sorteo-detalle', {
        title: `Sorteo: ${sorteo.nombre}`,
        page: 'sorteos',
        usuario: req.adminUser,
        scripts: '',
        sorteo, stats, boletos,
        ganancias: {
          bruto: fmt(bruto),
          fee: fmt(fee),
          neto: fmt(bruto - fee)
        }
      });
    } catch (err) {
      console.error(err);
      res.status(500).send('Error cargando detalle');
    }
  },

  // Participantes
  participantes: async (req, res) => {
    try {
      const sorteoId = req.query.sorteo;
      let query = `
  SELECT c.id, c.nombre, c.email, c.telefono,
         COUNT(b.id) as boletos_comprados,
         GROUP_CONCAT(b.numero ORDER BY b.numero SEPARATOR ', ') as numeros,
         s.nombre as sorteo_nombre,
         MAX(b.pin) as pin
  FROM compradores c
  JOIN boletos b ON b.comprador_id = c.id AND b.estado = 'vendido'
  JOIN sorteos s ON s.id = b.sorteo_id
`;
      const params = [];
      if (sorteoId) {
        query += ' WHERE b.sorteo_id = ?';
        params.push(sorteoId);
      }
      query += ' GROUP BY c.id, s.id ORDER BY boletos_comprados DESC';

      const [participantes] = await db.execute(query, params);
      const sorteos = await SorteoModel.getAll();

      res.render('admin/participantes', {
        title: 'Participantes',
        page: 'participantes',
        usuario: req.adminUser,
        scripts: '',
        participantes, sorteos,
        sorteoId: sorteoId || ''
      });
    } catch (err) {
      res.status(500).send('Error cargando participantes');
    }
  },

  // Ganadores
  ganadores: async (req, res) => {
    try {
      const [ganadores] = await db.execute(`
  SELECT g.id, g.sorteo_id, g.boleto_id, g.comprador_id,
         g.foto_url, g.comprobante_url, g.comprobante_tipo,
         CAST(g.notificado_email  AS UNSIGNED) AS notificado_email,
         CAST(g.notificado_wa     AS UNSIGNED) AS notificado_wa,
         CAST(g.premio_entregado  AS UNSIGNED) AS premio_entregado,
         CAST(g.visible_publico   AS UNSIGNED) AS visible_publico,
         CAST(g.pin_verificado    AS UNSIGNED) AS pin_verificado,
         g.created_at,
         s.nombre as sorteo_nombre,
         s.premio_descripcion,
         b.numero as boleto_numero,
         t.pin,
         c.nombre as comprador_nombre,
         c.email, c.telefono
  FROM ganadores g
  JOIN sorteos s ON s.id = g.sorteo_id
  JOIN boletos b ON b.id = g.boleto_id
  JOIN compradores c ON c.id = g.comprador_id
  LEFT JOIN transacciones t ON t.comprador_id = g.comprador_id
    AND t.sorteo_id = g.sorteo_id
    AND t.estado = 'completada'
  ORDER BY g.created_at DESC
`);

      const sorteos = await SorteoModel.getAll();

      res.render('admin/ganadores', {
        title: 'Ganadores',
        page: 'ganadores',
        usuario: req.adminUser,
        scripts: '',
        ganadores, sorteos
      });
    } catch (err) {
      res.status(500).send('Error cargando ganadores');
    }
  },

  // Verificar PIN
  verificarPin: (req, res) => {
    res.render('admin/verificar-pin', {
      title: 'Verificar PIN',
      page: 'verificar',
      usuario: req.adminUser,
      scripts: ''
    });
  },

  // Configuración
  configuracion: async (req, res) => {
    try {
      const [config] = await db.execute('SELECT * FROM configuracion');
      const configMap = {};
      config.forEach(c => configMap[c.clave] = c.valor);

      res.render('admin/configuracion', {
        title: 'Configuración',
        page: 'config',
        usuario: req.adminUser,
        scripts: '',
        config: configMap
      });
    } catch (err) {
      res.status(500).send('Error cargando configuración');
    }
  }
};

module.exports = adminController;