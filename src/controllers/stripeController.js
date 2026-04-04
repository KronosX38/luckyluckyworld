const StripeService  = require('../services/stripeService');
const BoletoModel    = require('../models/boletoModel');
const SorteoModel    = require('../models/sorteoModel');
const { generatePIN } = require('../utils/helpers');
const db             = require('../config/database');
const EmailService   = require('../services/emailService');

const stripeController = {

  // Crear intención de pago — el comprador procede al pago
  crearPago: async (req, res) => {
    try {
      const {
        reserva_id, nombre, email, telefono,
        metodo_pago = 'tarjeta'
      } = req.body;

      if (!reserva_id || !nombre || !email) {
        return res.status(400).json({ error: 'Faltan datos requeridos' });
      }

      // Obtener reserva
      const [reservas] = await db.execute(
        `SELECT * FROM reservas WHERE id = ? AND estado = 'activa' AND expira_at > NOW()`,
        [reserva_id]
      );
      if (reservas.length === 0) {
        return res.status(400).json({ error: 'Reserva expirada o no encontrada' });
      }
      const reserva = reservas[0];
      const numeros = JSON.parse(reserva.boletos_json);

      // Obtener sorteo y calcular monto
      const sorteo = await SorteoModel.findById(reserva.sorteo_id);
      const monto  = sorteo.precio_boleto * numeros.length;

      // Guardar o actualizar comprador
      const [compExist] = await db.execute(
        'SELECT id FROM compradores WHERE email = ?', [email]
      );

      let compradorId;
      if (compExist.length > 0) {
        compradorId = compExist[0].id;
      } else {
        const [comp] = await db.execute(
          'INSERT INTO compradores (nombre, email, telefono) VALUES (?, ?, ?)',
          [nombre, email, telefono || null]
        );
        compradorId = comp.insertId;
      }

      // Metadata para identificar el pago en el webhook
      const metadata = {
        reserva_id:   String(reserva_id),
        sorteo_id:    String(reserva.sorteo_id),
        comprador_id: String(compradorId),
        numeros:      numeros.join(','),
        nombre,
        email
      };

      let paymentIntent;

      if (metodo_pago === 'oxxo') {
        paymentIntent = await StripeService.crearPaymentIntentOXXO({
          monto, moneda: sorteo.moneda, nombre, email, metadata
        });
      } else {
        paymentIntent = await StripeService.crearPaymentIntent({
          monto, moneda: sorteo.moneda, metadata
        });
      }

      // Registrar transacción pendiente
      await db.execute(
        `INSERT INTO transacciones
          (reserva_id, comprador_id, sorteo_id, stripe_payment_id,
           monto_bruto, moneda, metodo_pago, estado)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pendiente')`,
        [reserva_id, compradorId, reserva.sorteo_id,
         paymentIntent.id, monto, sorteo.moneda, metodo_pago]
      );

      return res.json({
        ok: true,
        client_secret:    paymentIntent.client_secret,
        payment_intent_id: paymentIntent.id,
        monto,
        moneda:  sorteo.moneda,
        boletos: numeros
      });

    } catch (err) {
      console.error('Error creando pago:', err);
      return res.status(500).json({ error: 'Error procesando pago' });
    }
  },

  // Webhook — Stripe notifica cuando el pago se completa
  webhook: async (req, res) => {
    const signature = req.headers['stripe-signature'];

    let event;
    try {
      event = StripeService.verificarWebhook(req.body, signature);
    } catch (err) {
      console.error('Webhook inválido:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object;
      const {
        reserva_id, sorteo_id, comprador_id, numeros, nombre, email
      } = pi.metadata;

      try {
        const numerosArr = numeros.split(',');

        // Generar PIN único para cada boleto
        const pins = numerosArr.map(n => generatePIN(sorteo_id, n));

        // Confirmar boletos como vendidos
        await BoletoModel.confirmar(
          sorteo_id, numerosArr, comprador_id, pins
        );

        // Calcular fee de Stripe
        const monto_bruto = pi.amount / 100;
        const fee_pct     = 3.60;
        const fee         = monto_bruto * (fee_pct / 100);
        const neto        = monto_bruto - fee;

        // Actualizar transacción
        await db.execute(
          `UPDATE transacciones SET
            estado = 'completada',
            stripe_charge_id = ?,
            monto_stripe_fee = ?,
            monto_neto = ?
           WHERE stripe_payment_id = ?`,
          [pi.latest_charge, fee.toFixed(2), neto.toFixed(2), pi.id]
        );

        // Marcar reserva como completada
        await db.execute(
          `UPDATE reservas SET estado = 'completada' WHERE id = ?`,
          [reserva_id]
        );

        // Enviar correo de confirmación
        try {
          await EmailService.enviarConfirmacion({
            nombre, email,
            boletos:  numerosArr,
            pins,
            sorteo_id,
            monto:    monto_bruto
          });
        } catch (emailErr) {
          console.error('Error enviando correo:', emailErr.message);
        }

        console.log(`✅ Pago confirmado — Boletos: ${numeros} — Comprador: ${nombre}`);

      } catch (err) {
        console.error('Error procesando webhook:', err);
        return res.status(500).send('Error procesando pago');
      }
    }

    if (event.type === 'payment_intent.payment_failed') {
      const pi = event.data.object;
      await db.execute(
        `UPDATE transacciones SET estado = 'fallida' WHERE stripe_payment_id = ?`,
        [pi.id]
      );
      console.log(`❌ Pago fallido — Payment Intent: ${pi.id}`);
    }

    res.json({ received: true });
  }
};

module.exports = stripeController;