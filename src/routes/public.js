const express = require('express');
const router  = express.Router();
const SorteoModel = require('../models/sorteoModel');
const db = require('../config/database');

router.get('/', async (req, res) => {
  try {
    const sorteos = await SorteoModel.getActivos();
    const [config] = await db.execute(
      'SELECT valor FROM configuracion WHERE clave = "folio_segob"'
    );
    res.render('public/index', {
      sorteos,
      folio_segob:       config[0]?.valor || '',
      stripe_public_key: process.env.STRIPE_PUBLIC_KEY
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error cargando sorteos');
  }
});

module.exports = router;