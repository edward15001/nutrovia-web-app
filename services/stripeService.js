const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

/**
 * Crea un cliente de Stripe para un nuevo usuario
 */
async function createCustomer(email, name) {
    const customer = await stripe.customers.create({ email, name });
    return customer.id;
}

/**
 * Crea un SetupIntent para guardar la tarjeta sin cobrar
 * El cobro real se activa cuando finaliza el período de gracia (45 días)
 */
async function createSetupIntent(customerId) {
    const setupIntent = await stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ['card'],
        usage: 'off_session',
    });
    return setupIntent;
}

/**
 * Confirma el método de pago como predeterminado en el cliente
 */
async function attachPaymentMethod(customerId, paymentMethodId) {
    await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
    await stripe.customers.update(customerId, {
        invoice_settings: { default_payment_method: paymentMethodId },
    });
}

/**
 * Crea una suscripción en Stripe con prueba gratuita de 45 días
 * El primer cobro ocurre al día 45 desde trial_start
 */
async function createSubscription(customerId, trialEndTimestamp) {
    const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{
            price_data: {
                currency: 'eur',
                product_data: { name: 'NutroVia Plan Personalizado' },
                unit_amount: 6000, // 60.00 EUR en céntimos
                recurring: { interval: 'month' },
            }
        }],
        trial_end: trialEndTimestamp, // Unix timestamp del día 45
        payment_behavior: 'default_incomplete',
        expand: ['latest_invoice.payment_intent'],
    });
    return subscription;
}

/**
 * Cancela la suscripción en Stripe
 * @param {string} subscriptionId
 * @param {boolean} atPeriodEnd - Si true, cancela al final del período actual
 */
async function cancelSubscription(subscriptionId, atPeriodEnd = false) {
    if (atPeriodEnd) {
        return stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });
    }
    return stripe.subscriptions.cancel(subscriptionId);
}

/**
 * Recupera una suscripción de Stripe
 */
async function retrieveSubscription(subscriptionId) {
    return stripe.subscriptions.retrieve(subscriptionId);
}

/**
 * Construye el evento de Stripe desde el webhook con verificación de firma
 */
function constructWebhookEvent(payload, signature) {
    return stripe.webhooks.constructEvent(
        payload,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
    );
}

module.exports = {
    createCustomer,
    createSetupIntent,
    attachPaymentMethod,
    createSubscription,
    cancelSubscription,
    retrieveSubscription,
    constructWebhookEvent,
    stripe,
};
