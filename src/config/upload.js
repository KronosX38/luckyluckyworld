const multer = require('multer');
const path   = require('path');

// Storage para imágenes de sorteos
const storageSorteos = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/img/sorteos/');
  },
  filename: (req, file, cb) => {
    const ext  = path.extname(file.originalname);
    const name = `sorteo-${Date.now()}${ext}`;
    cb(null, name);
  }
});

// Storage para ganadores (fotos y comprobantes)
const storageGanadores = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/img/ganadores/');
  },
  filename: (req, file, cb) => {
    const ext  = path.extname(file.originalname);
    const name = `ganador-${Date.now()}${ext}`;
    cb(null, name);
  }
});

// Filtro para imágenes
const imageFilter = (req, file, cb) => {
  const allowedExt  = ['.jpg', '.jpeg', '.png', '.webp'];
  const allowedMime = ['image/jpeg', 'image/png', 'image/webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowedExt.includes(ext) || !allowedMime.includes(file.mimetype)) {
    return cb(new Error('Solo se permiten imágenes JPG, PNG o WEBP'));
  }
  cb(null, true);
};

// Filtro para comprobantes (imágenes + PDF)
const comprobanteFilter = (req, file, cb) => {
  const allowedExt  = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];
  const allowedMime = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowedExt.includes(ext) || !allowedMime.includes(file.mimetype)) {
    return cb(new Error('Solo se permiten imágenes JPG, PNG, WEBP o PDF'));
  }
  cb(null, true);
};

const upload = multer({
  storage:    storageSorteos,
  fileFilter: imageFilter,
  limits:     { fileSize: 5 * 1024 * 1024 }
});

const uploadGanador = multer({
  storage:    storageGanadores,
  fileFilter: imageFilter,
  limits:     { fileSize: 5 * 1024 * 1024 }
});

const uploadComprobante = multer({
  storage:    storageGanadores,
  fileFilter: comprobanteFilter,
  limits:     { fileSize: 10 * 1024 * 1024 } // 10MB para PDFs
});

module.exports = { upload, uploadGanador, uploadComprobante };