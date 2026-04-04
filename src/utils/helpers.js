const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Encriptar contraseña
const hashPassword = async (password) => {
  return await bcrypt.hash(password, 12);
};

// Verificar contraseña
const verifyPassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};

// Generar token JWT
const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });
};

// Verificar token JWT
const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

// Generar PIN único seguro
const generatePIN = (sorteoId, numero) => {
  const data = `${sorteoId}-${numero}-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
  return crypto.createHash('sha256').update(data).digest('hex').substring(0, 10).toUpperCase();
};

module.exports = { hashPassword, verifyPassword, generateToken, verifyToken, generatePIN };