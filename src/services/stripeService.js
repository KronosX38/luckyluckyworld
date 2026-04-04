const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const StripeService = {

  // Crear Payment Intent
  crearPaymentIntent: async ({ monto, moneda, metadata }) => {
    const paymentIntent = await stripe.paymentIntents.create({
      amount:   Math.round(monto * 100), // Stripe maneja centavos
      currency: moneda.toLowerCase(),
      metadata,
      payment_method_types: ['card'],
    });
    return paymentIntent;
  },

  // Crear Payment Intent con OXXO
  crearPaymentIntentOXXO: async ({ monto, moneda, nombre, email, metadata }) => {
    const paymentIntent = await stripe.paymentIntents.create({
      amount:   Math.round(monto * 100),
      currency: moneda.toLowerCase(),
      payment_method_types: ['oxxo'],
      payment_method_data: {
        type: 'oxxo',
        billing_details: { name: nombre, email }
      },
      confirm: true,
      metadata,
    });
    return paymentIntent;
  },

  // Verificar firma del webhook
  verificarWebhook: (payload, signature) => {
    return stripe.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  },

  // Obtener Payment Intent
  getPaymentIntent: async (id) => {
    return await stripe.paymentIntents.retrieve(id);
  }
};

module.exports = StripeService;