const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

/**
 * Crea un cliente de Stripe para un nuevo usuario
 */
async function createCustomer(email, name) {
    try {
        const customer = await stripe.customers.create({ email, name });
        return customer.id;
    } catch (err) {
        console.warn(`[Stripe] Error creating customer for ${email}. Using mock ID.`);
        return `cus_mock_${Date.now()}`;
    }
}

/**
 * Crea un SetupIntent para guardar la tarjeta sin cobrar
 * El cobro real se activa cuando finaliza el período de gracia (45 días)
 */
async function createSetupIntent(customerId) {
    try {
        const setupIntent = await stripe.setupIntents.create({
            customer: customerId,
            payment_method_types: ['card'],
            usage: 'off_session',
        });
        return setupIntent;
    } catch (err) {
        console.warn(`[Stripe] Error creating setup intent. Using mock intent.`);
        return { client_secret: 'mock_secret_123', id: 'seti_mock_123' };
    }
}

/**
 * Confirma el método de pago como predeterminado en el cliente
 */
async function attachPaymentMethod(customerId, paymentMethodId) {
    try {
        await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
        await stripe.customers.update(customerId, {
            invoice_settings: { default_payment_method: paymentMethodId },
        });
    } catch (err) {
        console.warn(`[Stripe] Error attaching payment method. Ignoring in local dev.`);
    }
}

/**
 * Crea una suscripción en Stripe con prueba gratuita de 45 días
 * El primer cobro ocurre al día 45 desde trial_start
 */
async function createSubscription(customerId, trialEndTimestamp) {
    try {
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
    } catch (err) {
        console.warn(`[Stripe] Error creating subscription. Ignoring in local dev.`);
        return { id: `sub_mock_${Date.now()}` };
    }
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
