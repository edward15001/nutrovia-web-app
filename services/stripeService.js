let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
}

// Precio del plan Pro mensual (configurable). Por defecto 14 €.
const PLAN_PRICE_EUR = parseFloat(process.env.PLAN_PRICE_EUR || '14');
const PLAN_PRICE_CENTS = Math.round(PLAN_PRICE_EUR * 100);

/**
 * Crea un cliente de Stripe para un nuevo usuario
 * Sin clave configurada devuelve un ID mock (desarrollo local);
 * con Stripe configurado, los errores reales se propagan (no se enmascaran).
 */
async function createCustomer(email, name) {
    if (!stripe) {
        console.warn('[Stripe] No configurado (falta STRIPE_SECRET_KEY). Usando customer mock.');
        return `cus_mock_${Date.now()}`;
    }
    const customer = await stripe.customers.create({ email, name });
    return customer.id;
}

/**
 * Crea un SetupIntent para guardar la tarjeta sin cobrar
 * El cobro real ocurre al crear la suscripción (cobro inmediato, sin trial)
 * Sin clave configurada devuelve un intent mock (desarrollo local).
 */
async function createSetupIntent(customerId) {
    if (!stripe) {
        console.warn('[Stripe] No configurado. Usando setup intent mock.');
        return { client_secret: 'mock_secret_123', id: 'seti_mock_123' };
    }
    const setupIntent = await stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ['card'],
        usage: 'off_session',
    });
    return setupIntent;
}

/**
 * Recupera un SetupIntent de Stripe (usado desde la app móvil, donde
 * PaymentSheet no devuelve el payment_method directamente: el cliente
 * envía el setup_intent_id y aquí se resuelve su payment_method).
 */
async function retrieveSetupIntent(setupIntentId) {
    if (!stripe) {
        // Modo mock (sin STRIPE_SECRET_KEY): simular un payment method
        if (setupIntentId && setupIntentId.startsWith('seti_mock_')) {
            return { id: setupIntentId, payment_method: `pm_mock_${Date.now()}` };
        }
        return { id: setupIntentId, payment_method: null };
    }
    return stripe.setupIntents.retrieve(setupIntentId);
}

/**
 * Confirma el método de pago como predeterminado en el cliente
 */
async function attachPaymentMethod(customerId, paymentMethodId) {
    if (!stripe) {
        console.warn('[Stripe] No configurado. Omitiendo attach de método de pago.');
        return;
    }
    await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
    await stripe.customers.update(customerId, {
        invoice_settings: { default_payment_method: paymentMethodId },
    });
}

// Cache del Price de Stripe. Buscamos uno existente (por si el servidor se reinició)
// antes de crear otro nuevo, para no duplicar prices en cada cold start.
let cachedPriceId = null;

async function getOrCreatePrice() {
    if (cachedPriceId) return cachedPriceId;

    const existing = await stripe.prices.list({
        limit: 100,
        active: true,
        currency: 'eur',
        recurring: { interval: 'month' },
    });
    const match = existing.data.find(p => p.unit_amount === PLAN_PRICE_CENTS);
    if (match) {
        cachedPriceId = match.id;
        return match.id;
    }

    const price = await stripe.prices.create({
        currency: 'eur',
        unit_amount: PLAN_PRICE_CENTS,    // Precio del plan en céntimos
    // Nota: al cambiar el precio se busca/crea un Price nuevo (no reusa el antiguo).
        recurring: { interval: 'month' },
        product_data: { name: 'NutroVia Plan Personalizado' },
    });
    cachedPriceId = price.id;
    return price.id;
}

/**
 * Crea una suscripción en Stripe con cobro inmediato (sin prueba gratuita):
 * la primera factura de 14 € se cobra al momento de activar Pro.
 * Sin clave configurada devuelve un ID mock (desarrollo local).
 */
async function createSubscription(customerId) {
    if (!stripe) {
        console.warn('[Stripe] No configurado. Usando suscripción mock.');
        return { id: `sub_mock_${Date.now()}` };
    }
    const priceId = await getOrCreatePrice();
    const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete',
        expand: ['latest_invoice.payment_intent'],
    });
    return subscription;
}

/**
 * Cancela la suscripción en Stripe (idempotente: si ya no existe, se considera cancelada)
 * @param {string} subscriptionId
 * @param {boolean} atPeriodEnd - Si true, cancela al final del período actual
 */
async function cancelSubscription(subscriptionId, atPeriodEnd = false) {
    // En desarrollo sin Stripe real, o con ids de fallback (mock), no llamamos a la API
    if (!stripe || (subscriptionId && subscriptionId.startsWith('sub_mock_'))) {
        return { status: 'mock_canceled' };
    }
    try {
        if (atPeriodEnd) {
            return await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });
        }
        return await stripe.subscriptions.cancel(subscriptionId);
    } catch (err) {
        // Cancelar un trial elimina la suscripción en Stripe, así que al re-suscribirse
        // puede que la anterior ya no exista. No es un error real.
        if (err && err.type === 'StripeInvalidRequestError' && /no such subscription/i.test(err.message || '')) {
            console.warn(`[Stripe] Suscripción ${subscriptionId} ya no existe (ya cancelada).`);
            return { status: 'already_canceled' };
        }
        throw err;
    }
}

/**
 * Recupera una suscripción de Stripe
 */
async function retrieveSubscription(subscriptionId) {
    if (!stripe) return { status: 'active', id: subscriptionId };
    return stripe.subscriptions.retrieve(subscriptionId);
}

/**
 * Construye el evento de Stripe desde el webhook con verificación de firma
 */
function constructWebhookEvent(payload, signature) {
    if (!stripe) throw new Error('Stripe is not configured for webhooks');
    return stripe.webhooks.constructEvent(
        payload,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
    );
}

module.exports = {
    createCustomer,
    createSetupIntent,
    retrieveSetupIntent,
    attachPaymentMethod,
    createSubscription,
    cancelSubscription,
    retrieveSubscription,
    constructWebhookEvent,
    stripe,
};
