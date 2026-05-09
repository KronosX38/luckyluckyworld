const express     = require('express');
const router      = express.Router();
const SorteoModel = require('../models/sorteoModel');
const db          = require('../config/database');

// Helper para datos comunes
async function getCommonData() {
  const [config]   = await db.execute('SELECT clave, valor FROM configuracion');
  const configMap  = {};
  config.forEach(c => configMap[c.clave] = c.valor);
  return configMap;
}

// INICIO
router.get('/', async (req, res) => {
  try {
    const sorteos    = await SorteoModel.getActivos();
    const config     = await getCommonData();
    const [vendidos] = await db.execute('SELECT COUNT(*) as total FROM boletos WHERE estado = "vendido"');
    const [gans]     = await db.execute('SELECT COUNT(*) as total FROM ganadores WHERE visible_publico = 1');

    res.render('public/index', {
      page:              'inicio',
      sorteos,
      folio_segob:       config.folio_segob || '',
      stripe_public_key: process.env.STRIPE_PUBLIC_KEY,
      totalVendidos:     vendidos[0]?.total || 0,
      totalGanadores:    gans[0]?.total || 0
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error cargando página');
  }
});

// SORTEOS
router.get('/sorteos', async (req, res) => {
  try {
    const sorteos = await SorteoModel.getActivos();
    const config  = await getCommonData();
    res.render('public/sorteos', {
      page: 'sorteos', sorteos,
      folio_segob: config.folio_segob || ''
    });
  } catch (err) {
    res.status(500).send('Error');
  }
});

// DETALLE SORTEO
router.get('/sorteos/:id', async (req, res) => {
  try {
    const sorteo = await SorteoModel.findById(req.params.id);
    if (!sorteo || sorteo.estado !== 'activo') return res.redirect('/sorteos');

    const config = await getCommonData();

    // Verificar si ya cerró ventas por tiempo
    let ventasCerradas = false;
    let minutosRestantes = null;

    if (sorteo.fecha_sorteo) {
      const minutosCierre = parseInt(config.minutos_cierre_ventas || 15);
      const ahora         = new Date();
      const fechaSorteo   = new Date(sorteo.fecha_sorteo);
      const diffMs        = fechaSorteo - ahora;
      const diffMin       = Math.floor(diffMs / 60000);

      if (diffMin <= minutosCierre) {
        ventasCerradas  = true;
        minutosRestantes = diffMin > 0 ? diffMin : 0;
      }
    }

    res.render('public/sorteo', {
      page:              'sorteos',
      sorteo,
      folio_segob:       config.folio_segob || '',
      stripe_public_key: process.env.STRIPE_PUBLIC_KEY,
      ventasCerradas,
      minutosRestantes
    });
  } catch (err) {
    res.status(500).send('Error');
  }
});

// GANADORES
router.get('/ganadores', async (req, res) => {
  try {
    const config = await getCommonData();
    const [ganadores] = await db.execute(`
      SELECT g.foto_url, g.visible_publico,
             CONCAT(
               SUBSTRING_INDEX(c.nombre, ' ', 1), ' ',
               LEFT(SUBSTRING(c.nombre, LOCATE(' ', c.nombre) + 1), 1), '.'
             ) as nombre_publico,
             s.nombre as sorteo_nombre,
             s.premio_descripcion,
             b.numero as boleto_numero
      FROM ganadores g
      JOIN compradores c ON c.id = g.comprador_id
      JOIN sorteos s ON s.id = g.sorteo_id
      JOIN boletos b ON b.id = g.boleto_id
      WHERE g.visible_publico = 1
      ORDER BY g.created_at DESC
    `);
    res.render('public/ganadores', {
      page: 'ganadores', ganadores,
      folio_segob: config.folio_segob || ''
    });
  } catch (err) {
    res.status(500).send('Error');
  }
});

// NOSOTROS
router.get('/nosotros', async (req, res) => {
  try {
    const config = await getCommonData();
    res.render('public/nosotros', {
      page: 'nosotros',
      folio_segob: config.folio_segob || '',
      whatsapp:    config.whatsapp_numero || ''
    });
  } catch (err) {
    res.status(500).send('Error');
  }
});

// TÉRMINOS Y PRIVACIDAD (placeholder)
router.get('/terminos', (req, res) => res.render('public/terminos', { page: '' }));
router.get('/privacidad', (req, res) => res.render('public/privacidad', { page: '' }));

module.exports = router;