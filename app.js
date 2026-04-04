const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const cookieParser = require('cookie-parser');
const db = require('./src/config/database');

const app = express();

// ── SEGURIDAD 
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://js.stripe.com", "https://www.google.com"],
      frameSrc: ["'self'", "https://js.stripe.com", "https://www.youtube.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.stripe.com"],
    }
  }
}));
app.use(cors({
  origin: process.env.APP_URL,
  credentials: true
}));

// ── WEBHOOK STRIPE (antes de express.json) ──
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));

// ── MIDDLEWARES ──
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── ARCHIVOS ESTÁTICOS ──
app.use(express.static(path.join(__dirname, 'public')));

// ── VISTAS ──
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));



// ── RUTAS ──
app.use('/api/auth',    require('./src/routes/auth'));
app.use('/api/sorteos', require('./src/routes/sorteos'));
app.use('/api/sorteos/:sorteoId/boletos', require('./src/routes/boletos'));
app.use('/api/stripe',  require('./src/routes/stripe'));
app.use('/api/admin',   require('./src/routes/admin'));
app.use('/admin',       require('./src/routes/admin'));

// ── RUTA DE PRUEBA ──
app.get('/ping', (req, res) => {
  res.json({ status: 'ok', mensaje: 'Servidor funcionando correctamente' });
});

// ← Esta siempre debe ir AL ÚLTIMO
app.use('/',            require('./src/routes/public'));

// ── MANEJO DE ERRORES ──
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// ── CRON JOB — Liberar reservas expiradas cada minuto ──
const BoletoService = require('./src/services/boletoService');
setInterval(async () => {
  try {
    await BoletoService.liberarExpiradas();
  } catch (err) {
    console.error('Error en cron de reservas:', err.message);
  }
}, 60 * 1000); // cada 60 segundos

// ── INICIAR SERVIDOR ──
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
});

module.exports = app;