const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host:     process.env.DB_HOST,
  port:     process.env.DB_PORT,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '-06:00'
});

// Verificar conexión al arrancar
pool.getConnection()
  .then(conn => {
    console.log('✅ Base de datos conectada correctamente');
    conn.release();
  })
  .catch(err => {
    console.error('❌ Error conectando a la base de datos:');
    console.error('   Mensaje:', err.message);
    console.error('   Código:', err.code);
  });

module.exports = pool;