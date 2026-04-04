const db = require('./database');
const { hashPassword } = require('../utils/helpers');

async function crearAdmin() {
  try {
    const hash = await hashPassword('Admin123!');

    await db.execute(`
      INSERT IGNORE INTO usuarios (nombre, email, password_hash, rol)
      VALUES (?, ?, ?, ?)
    `, ['Administrador', 'admin@sorteos.com', hash, 'admin_owner']);

    console.log('✅ Usuario admin creado correctamente');
    console.log('   Email:    admin@sorteos.com');
    console.log('   Password: Admin123!');
    console.log('   ⚠️  Cambia la contraseña después del primer login');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

crearAdmin();