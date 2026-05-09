const SorteoModel  = require('../models/sorteoModel');
const db           = require('../config/database');
const Logger = require('../utils/logger');

const sorteoController = {

  // Listar todos (panel admin)
  listar: async (req, res) => {
    try {
      const sorteos = await SorteoModel.getAll();
      return res.json({ ok: true, sorteos });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error obteniendo sorteos' });
    }
  },

  // Listar activos (página pública)
  listarActivos: async (req, res) => {
    try {
      const sorteos = await SorteoModel.getActivos();
      return res.json({ ok: true, sorteos });
    } catch (err) {
      return res.status(500).json({ error: 'Error obteniendo sorteos' });
    }
  },

  // Obtener uno por ID
  obtener: async (req, res) => {
    try {
      const sorteo = await SorteoModel.findById(req.params.id);
      if (!sorteo) return res.status(404).json({ error: 'Sorteo no encontrado' });
      return res.json({ ok: true, sorteo });
    } catch (err) {
      return res.status(500).json({ error: 'Error obteniendo sorteo' });
    }
  },

  // Crear sorteo
  crear: async (req, res) => {
    try {
      const {
        nombre, descripcion, boleto_inicio, boleto_fin,
        precio_boleto, moneda, premio_descripcion, premio_monto,
        premio_moneda, fecha_sorteo, youtube_link, folio_segob
      } = req.body;

      // Validaciones básicas
      if (!nombre || !boleto_inicio || !boleto_fin || !precio_boleto) {
        return res.status(400).json({ error: 'Faltan campos requeridos' });
      }
      if (parseInt(boleto_inicio) >= parseInt(boleto_fin)) {
        return res.status(400).json({ error: 'El rango de boletos es inválido' });
      }

      // Verificar límite de sorteos activos
      const [config] = await db.execute(
        'SELECT valor FROM configuracion WHERE clave = "max_sorteos_activos"'
      );
      const maxActivos = parseInt(config[0]?.valor || 3);
      const activos = await SorteoModel.countActivos();

      if (activos >= maxActivos) {
        return res.status(400).json({
          error: `Límite de ${maxActivos} sorteos activos alcanzado`
        });
      }

      const id = await SorteoModel.create({
        ...req.body,
        created_by: req.usuario.id
      });

            await Logger.registrar({
        usuario_id:    req.usuario.id,
        usuario_email: req.usuario.email,
        accion:        'SORTEO_CREADO',
        detalle:       `Sorteo: ${nombre}`,
        ip:            req.ip
      });

      return res.status(201).json({
        ok: true,
        mensaje: 'Sorteo creado correctamente',
        id
      });

    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error creando sorteo' });
    }
  },

  // Activar sorteo
activar: async (req, res) => {
  try {
    const sorteo = await SorteoModel.findById(req.params.id);
    if (!sorteo) return res.status(404).json({ error: 'Sorteo no encontrado' });
    if (sorteo.estado !== 'borrador') {
      return res.status(400).json({ error: 'Solo se pueden activar sorteos en borrador' });
    }

    // Verificar límite de sorteos activos
    const [config] = await db.execute(
      'SELECT valor FROM configuracion WHERE clave = "max_sorteos_activos"'
    );
    const maxActivos = parseInt(config[0]?.valor || 3);
    const activos = await SorteoModel.countActivos();
    if (activos >= maxActivos) {
      return res.status(400).json({
        error: `Límite de ${maxActivos} sorteos activos alcanzado`
      });
    }

    // Activar sorteo
    await SorteoModel.activar(req.params.id);

    // Generar boletos automáticamente
    const BoletoService = require('../services/boletoService');
    await BoletoService.generarBoletos(
      req.params.id,
      sorteo.boleto_inicio,
      sorteo.boleto_fin
    );
    await Logger.registrar({
      usuario_id:    req.usuario.id,
      usuario_email: req.usuario.email,
      accion:        'SORTEO_ACTIVADO',
      detalle:       `Sorteo: ${sorteo.nombre}`,
      ip:            req.ip
    });

    return res.json({
      ok: true,
      mensaje: `Sorteo activado con ${sorteo.boleto_fin - sorteo.boleto_inicio + 1} boletos generados`
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error activando sorteo' });
  }
},

  // Cerrar sorteo
  cerrar: async (req, res) => {
    try {
      const sorteo = await SorteoModel.findById(req.params.id);
      if (!sorteo) return res.status(404).json({ error: 'Sorteo no encontrado' });

      await SorteoModel.cerrar(req.params.id);

      // Cancelar boletos reservados o disponibles
      await Logger.registrar({
        usuario_id:    req.usuario.id,
        usuario_email: req.usuario.email,
        accion:        'SORTEO_CERRADO',
        detalle:       `Sorteo: ${sorteo.nombre}`,
        ip:            req.ip
      });

      return res.json({ ok: true, mensaje: 'Sorteo cerrado correctamente' });
    } catch (err) {
      return res.status(500).json({ error: 'Error cerrando sorteo' });
    }
  },

  // Actualizar YouTube link
  updateYoutube: async (req, res) => {
    try {
      const { youtube_link } = req.body;
      await SorteoModel.updateYoutube(req.params.id, youtube_link);
      return res.json({ ok: true, mensaje: 'Link de YouTube actualizado' });
    } catch (err) {
      return res.status(500).json({ error: 'Error actualizando link' });
    }
  }
};

module.exports = sorteoController;