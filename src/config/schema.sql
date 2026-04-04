-- ── USUARIOS (admins del panel) ──
CREATE TABLE IF NOT EXISTS usuarios (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  nombre        VARCHAR(100) NOT NULL,
  email         VARCHAR(150) NOT NULL UNIQUE,
  telefono      VARCHAR(20),
  password_hash VARCHAR(255) NOT NULL,
  rol           ENUM('admin_owner','admin_operator') NOT NULL,
  activo        TINYINT(1) DEFAULT 1,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── SORTEOS ──
CREATE TABLE IF NOT EXISTS sorteos (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  nombre             VARCHAR(150) NOT NULL,
  descripcion        TEXT,
  boleto_inicio      INT NOT NULL,
  boleto_fin         INT NOT NULL,
  precio_boleto      DECIMAL(10,2) NOT NULL,
  moneda             ENUM('MXN','USD') DEFAULT 'MXN',
  premio_descripcion TEXT,
  premio_monto       DECIMAL(10,2),
  premio_moneda      ENUM('MXN','USD') DEFAULT 'MXN',
  fecha_sorteo       DATETIME,
  youtube_link       VARCHAR(255),
  folio_segob        VARCHAR(100),
  estado             ENUM('borrador','activo','cerrado','cancelado') DEFAULT 'borrador',
  created_by         INT,
  created_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES usuarios(id)
);

-- ── COMPRADORES ──
CREATE TABLE IF NOT EXISTS compradores (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  nombre     VARCHAR(100) NOT NULL,
  email      VARCHAR(150) NOT NULL,
  telefono   VARCHAR(20),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── BOLETOS ──
CREATE TABLE IF NOT EXISTS boletos (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  sorteo_id      INT NOT NULL,
  numero         VARCHAR(10) NOT NULL,
  estado         ENUM('disponible','reservado','vendido','cancelado') DEFAULT 'disponible',
  comprador_id   INT,
  pin            VARCHAR(20),
  transaccion_id INT,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_boleto (sorteo_id, numero),
  FOREIGN KEY (sorteo_id) REFERENCES sorteos(id),
  FOREIGN KEY (comprador_id) REFERENCES compradores(id)
);

-- ── RESERVAS (carrito 5 minutos) ──
CREATE TABLE IF NOT EXISTS reservas (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  sorteo_id    INT NOT NULL,
  boletos_json JSON NOT NULL,
  email        VARCHAR(150),
  expira_at    DATETIME NOT NULL,
  estado       ENUM('activa','completada','expirada') DEFAULT 'activa',
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sorteo_id) REFERENCES sorteos(id)
);

-- ── TRANSACCIONES ──
CREATE TABLE IF NOT EXISTS transacciones (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  reserva_id        INT NOT NULL,
  comprador_id      INT NOT NULL,
  sorteo_id         INT NOT NULL,
  stripe_payment_id VARCHAR(255) UNIQUE,
  stripe_charge_id  VARCHAR(255),
  monto_bruto       DECIMAL(10,2) NOT NULL,
  monto_stripe_fee  DECIMAL(10,2),
  monto_neto        DECIMAL(10,2),
  moneda            ENUM('MXN','USD') DEFAULT 'MXN',
  metodo_pago       ENUM('tarjeta','oxxo') NOT NULL,
  estado            ENUM('pendiente','completada','fallida','reembolsada') DEFAULT 'pendiente',
  stripe_fee_pct    DECIMAL(5,2) DEFAULT 3.60,
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (reserva_id) REFERENCES reservas(id),
  FOREIGN KEY (comprador_id) REFERENCES compradores(id),
  FOREIGN KEY (sorteo_id) REFERENCES sorteos(id)
);

-- ── GANADORES ──
CREATE TABLE IF NOT EXISTS ganadores (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  sorteo_id         INT NOT NULL,
  boleto_id         INT NOT NULL,
  comprador_id      INT NOT NULL,
  foto_url          VARCHAR(255),
  notificado_email  TINYINT(1) DEFAULT 0,
  notificado_wa     TINYINT(1) DEFAULT 0,
  premio_entregado  TINYINT(1) DEFAULT 0,
  visible_publico   TINYINT(1) DEFAULT 1,
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sorteo_id) REFERENCES sorteos(id),
  FOREIGN KEY (boleto_id) REFERENCES boletos(id),
  FOREIGN KEY (comprador_id) REFERENCES compradores(id)
);

-- ── CONFIGURACIÓN ──
CREATE TABLE IF NOT EXISTS configuracion (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  clave      VARCHAR(100) NOT NULL UNIQUE,
  valor      TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Valores iniciales de configuración
INSERT IGNORE INTO configuracion (clave, valor) VALUES
  ('stripe_fee_pct',    '3.60'),
  ('reserva_minutos',   '5'),
  ('cuadricula_limite', '500'),
  ('correo_remitente',  ''),
  ('whatsapp_numero',   ''),
  ('folio_segob',       ''),
  ('max_boletos_carrito','20');

-- ── ÍNDICES PARA RENDIMIENTO ──
CREATE INDEX IF NOT EXISTS idx_boletos_sorteo_estado
  ON boletos(sorteo_id, estado);

CREATE INDEX IF NOT EXISTS idx_transacciones_stripe
  ON transacciones(stripe_payment_id);

CREATE INDEX IF NOT EXISTS idx_reservas_expira
  ON reservas(expira_at, estado);