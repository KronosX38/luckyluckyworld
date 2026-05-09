const BoletoModel = require('../models/boletoModel');
const SorteoModel = require('../models/sorteoModel');
const { generatePIN } = require('../utils/helpers');
const db = require('../config/database');

const boletoController = {

  // Obtener boletos de un sorteo (cuadrícula o buscador)
  getBySorteo: async (req, res) => {
    try {
      const sorteo = await SorteoModel.findById(req.params.sorteoId);
      if (!sorteo) return res.status(404).json({ error: 'Sorteo no encontrado' });

      const total = sorteo.boleto_fin - sorteo.boleto_inicio + 1;

      // Obtener límite de cuadrícula desde configuración
      const [config] = await db.execute(
        'SELECT valor FROM configuracion WHERE clave = "cuadricula_limite"'
      );
      const limite = parseInt(config[0]?.valor || 500);

      const boletos = await BoletoModel.getBySorteo(req.params.sorteoId);
      const stats = await BoletoModel.getStats(req.params.sorteoId);

      return res.json({
        ok: true,
        modo: total <= limite ? 'cuadricula' : 'buscador',
        total,
        stats,
        boletos: total <= limite ? boletos : [] // solo manda boletos en modo cuadrícula
      });

    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error obteniendo boletos' });
    }
  },

  // Buscar un boleto específico (modo buscador)
  buscar: async (req, res) => {
    try {
      const { sorteoId, numero } = req.params;
      const sorteo = await SorteoModel.findById(sorteoId);
      if (!sorteo) return res.status(404).json({ error: 'Sorteo no encontrado' });

      // Formatear número con ceros a la izquierda
      const digitos = String(sorteo.boleto_fin).length;
      const numeroFormateado = String(numero).padStart(digitos, '0');

      const boleto = await BoletoModel.buscar(sorteoId, numeroFormateado);
      if (!boleto) {
        return res.status(404).json({ error: 'Número no existe en este sorteo' });
      }

      return res.json({ ok: true, boleto });

    } catch (err) {
      return res.status(500).json({ error: 'Error buscando boleto' });
    }
  },

  // Número aleatorio disponible
  aleatorio: async (req, res) => {
    try {
      const disponibles = await BoletoModel.getDisponibles(req.params.sorteoId);
      if (disponibles.length === 0) {
        return res.status(404).json({ error: 'No hay boletos disponibles' });
      }
      const random = disponibles[Math.floor(Math.random() * disponibles.length)];
      return res.json({ ok: true, numero: random });
    } catch (err) {
      return res.status(500).json({ error: 'Error obteniendo número aleatorio' });
    }
  },

  // Crear reserva — al iniciar el proceso de pago
  reservar: async (req, res) => {
    try {
      const { sorteoId } = req.params;
      const { numeros, nombre, email, telefono } = req.body;

      if (!numeros || !Array.isArray(numeros) || numeros.length === 0) {
        return res.status(400).json({ error: 'Debes seleccionar al menos un boleto' });
      }
      if (!nombre || !email) {
        return res.status(400).json({ error: 'Nombre y email son requeridos' });
      }

      // Verificar límite de boletos por carrito
      const [config] = await db.execute(
        'SELECT valor FROM configuracion WHERE clave = "max_boletos_carrito"'
      );
      const maxCarrito = parseInt(config[0]?.valor || 20);
      if (numeros.length > maxCarrito) {
        return res.status(400).json({
          error: `Máximo ${maxCarrito} boletos por transacción`
        });
      }

      // Verificar que el sorteo esté activo
      const sorteo = await SorteoModel.findById(sorteoId);
      if (!sorteo || sorteo.estado !== 'activo') {
        return res.status(400).json({ error: 'El sorteo no está activo' });
      }

      // Verificar cierre automático de ventas por tiempo
      if (sorteo.fecha_sorteo) {
        const [configCierre] = await db.execute(
          'SELECT valor FROM configuracion WHERE clave = "minutos_cierre_ventas"'
        );
        const minutosCierre = parseInt(configCierre[0]?.valor || 15);
        const ahora = new Date();
        const fechaSorteo = new Date(sorteo.fecha_sorteo);
        const diffMin = Math.floor((fechaSorteo - ahora) / 60000);

        if (diffMin <= minutosCierre) {
          return res.status(400).json({
            error: `Las ventas cerraron ${minutosCierre} minutos antes del sorteo`
          });
        }
      }

      // Verificar disponibilidad de todos los boletos
      const digitos = String(sorteo.boleto_fin).length;
      const numerosFormateados = numeros.map(n =>
        String(n).padStart(digitos, '0')
      );

      const estadoBoletos = await BoletoModel.checkDisponibles(sorteoId, numerosFormateados);
      const noDisponibles = estadoBoletos.filter(b => b.estado !== 'disponible');

      if (noDisponibles.length > 0) {
        return res.status(409).json({
          error: 'Algunos boletos ya no están disponibles',
          boletos: noDisponibles.map(b => b.numero)
        });
      }

      // Obtener tiempo de reserva desde config
      const [configRes] = await db.execute(
        'SELECT valor FROM configuracion WHERE clave = "reserva_minutos"'
      );
      const minutos = parseInt(configRes[0]?.valor || 5);

      // Crear reserva
      const expira = new Date(Date.now() + minutos * 60 * 1000);
      const [result] = await db.execute(
        `INSERT INTO reservas (sorteo_id, boletos_json, email, expira_at)
         VALUES (?, ?, ?, ?)`,
        [sorteoId, JSON.stringify(numerosFormateados), email, expira]
      );
      const reservaId = result.insertId;

      // Reservar boletos en la BD
      await BoletoModel.reservar(sorteoId, numerosFormateados, reservaId);

      return res.status(201).json({
        ok: true,
        reserva_id: reservaId,
        boletos: numerosFormateados,
        expira_at: expira,
        minutos_restantes: minutos,
        mensaje: `Boletos reservados por ${minutos} minutos`
      });

    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error creando reserva' });
    }
  },

  // Verificar PIN del ganador
  verificarPIN: async (req, res) => {
    try {
      const { sorteoId } = req.params;
      const { pin } = req.body;

      if (!pin) return res.status(400).json({ error: 'PIN requerido' });

      const resultado = await BoletoModel.verificarPIN(sorteoId, pin.toUpperCase());

      if (!resultado) {
        return res.status(404).json({ error: 'PIN inválido o no corresponde a este sorteo' });
      }

      return res.json({
        ok: true,
        mensaje: '¡PIN válido! Boleto ganador verificado.',
        boleto: resultado.numero,
        comprador: {
          nombre: resultado.nombre,
          email: resultado.email,
          telefono: resultado.telefono
        }
      });

    } catch (err) {
      return res.status(500).json({ error: 'Error verificando PIN' });
    }
  },

  // Stats del sorteo para el dashboard
  getStats: async (req, res) => {
    try {
      const stats = await BoletoModel.getStats(req.params.sorteoId);
      const sorteo = await SorteoModel.findById(req.params.sorteoId);

      // Calcular ganancias
      const bruto = stats.vendidos * sorteo.precio_boleto;
      const [config] = await db.execute(
        'SELECT valor FROM configuracion WHERE clave = "stripe_fee_pct"'
      );
      const feePct = parseFloat(config[0]?.valor || 3.60);
      const fee = bruto * (feePct / 100);
      const neto = bruto - fee;

      return res.json({
        ok: true,
        stats,
        ganancias: {
          bruto: bruto.toFixed(2),
          fee_pct: feePct,
          fee: fee.toFixed(2),
          neto: neto.toFixed(2),
          moneda: sorteo.moneda
        }
      });

    } catch (err) {
      return res.status(500).json({ error: 'Error obteniendo estadísticas' });
    }
  }
};

module.exports = boletoController;