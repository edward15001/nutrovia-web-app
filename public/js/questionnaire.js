// ─── NutroVia — questionnaire.js ────────────────────────────

// ═══ Estado del formulario ═══════════════════════════════════
const formData = {
    name: '', email: '', password: '',
    sex: null, age: null, height: null, weight: null, targetWeight: null,
    goal: null, activity_level: null,
    dietary_preference: null, training_experience: null, training_days: 3,
    health_conditions: [],
};

let currentStep = 1;
const TOTAL_STEPS = 8;
let stripe, stripeElements, cardElement;
let authToken = null;

// ═══ Inicializar Stripe ═══════════════════════════════════════
async function initStripe() {
    try {
        const res = await fetch('/api/subscription/setup-intent', {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        stripe = Stripe(data.publishable_key);
        stripeElements = stripe.elements();
        cardElement = stripeElements.create('card', {
            style: {
                base: {
                    color: '#e8e0d0',
                    fontFamily: 'Outfit, sans-serif',
                    fontSize: '15px',
                    '::placeholder': { color: '#555550' },
                    backgroundColor: 'transparent',
                },
                invalid: { color: '#e88888' },
            }
        });
        cardElement.mount('#stripe-card-element');

        cardElement.on('change', (e) => {
            document.getElementById('card-error').textContent = e.error ? e.error.message : '';
        });

        window._stripeSetupClientSecret = data.client_secret;
    } catch (err) {
        console.error('Error iniciando Stripe:', err);
        document.getElementById('alert-7').textContent = 'Error al cargar el formulario de pago. Recarga la página.';
        document.getElementById('alert-7').style.display = 'block';
    }
}

// ═══ Navegación entre pasos ═══════════════════════════════════
function goToStep(targetStep) {
    if (!validateStep(currentStep)) return;
    if (targetStep > currentStep) collectStepData(currentStep);

    document.getElementById(`step-${currentStep}`).style.display = 'none';
    currentStep = targetStep;
    document.getElementById(`step-${currentStep}`).style.display = 'block';
    updateProgress();

    // Inicializar Stripe al llegar al paso 7
    if (currentStep === 7 && !stripe && authToken) {
        initStripe();
    }
    // Si aún no tiene token, hay que registrar al llegar al paso 7
    if (currentStep === 7 && !authToken) {
        registerUser();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateProgress() {
    const pct = Math.round((currentStep / TOTAL_STEPS) * 100);
    document.getElementById('progressBar').style.width = `${pct}%`;
    document.getElementById('progressText').textContent = `Paso ${currentStep} de ${TOTAL_STEPS}`;
}

// ═══ Validación por paso ═════════════════════════════════════
function validateStep(step) {
    const alertEl = document.getElementById(`alert-${step}`);
    const hideAlert = () => { if (alertEl) alertEl.style.display = 'none'; };
    const showAlert = (msg) => {
        if (!alertEl) return false;
        alertEl.textContent = msg;
        alertEl.style.display = 'block';
        return false;
    };
    hideAlert();

    switch (step) {
        case 1: {
            const name = document.getElementById('q-name').value.trim();
            const email = document.getElementById('q-email').value.trim();
            const pass = document.getElementById('q-password').value;
            if (!name) return showAlert('Por favor introduce tu nombre.');
            if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showAlert('Email inválido.');
            if (pass.length < 8) return showAlert('La contraseña debe tener mínimo 8 caracteres.');
            return true;
        }
        case 2: {
            if (!formData.sex) return showAlert('Selecciona tu sexo biológico.');
            const age = parseInt(document.getElementById('q-age').value);
            const h = parseInt(document.getElementById('q-height').value);
            const w = parseFloat(document.getElementById('q-weight').value);
            if (!age || age < 15 || age > 100) return showAlert('Introduce una edad válida (15-100).');
            if (!h || h < 100 || h > 230) return showAlert('Introduce una altura válida (100-230 cm).');
            if (!w || w < 30 || w > 300) return showAlert('Introduce un peso válido (30-300 kg).');
            return true;
        }
        case 3:
            if (!formData.goal) return showAlert('Selecciona tu objetivo principal.');
            return true;
        case 4:
            if (!formData.activity_level) return showAlert('Selecciona tu nivel de actividad.');
            return true;
        case 5: {
            if (!formData.dietary_preference) return showAlert('Selecciona tu preferencia dietética.');
            if (!formData.training_experience) return showAlert('Selecciona tu nivel de experiencia en el gym.');
            return true;
        }
        default: return true;
    }
}

// ═══ Recopilar datos del paso ════════════════════════════════
function collectStepData(step) {
    switch (step) {
        case 1:
            formData.name = document.getElementById('q-name').value.trim();
            formData.email = document.getElementById('q-email').value.trim();
            formData.password = document.getElementById('q-password').value;
            break;
        case 2:
            formData.age = parseInt(document.getElementById('q-age').value);
            formData.height = parseInt(document.getElementById('q-height').value);
            formData.weight = parseFloat(document.getElementById('q-weight').value);
            const tw = document.getElementById('q-target-weight').value;
            formData.targetWeight = tw ? parseFloat(tw) : null;
            break;
        case 5:
            formData.training_days = parseInt(document.getElementById('trainingDays').value);
            break;
    }
}

// ═══ Selección de opciones ═══════════════════════════════════
function selectOption(btn, field, value) {
    // Desmarcar todos los botones del mismo grupo
    const parent = btn.closest('.option-grid');
    if (parent) parent.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    formData[field] = value;
}

function toggleCondition(el) {
    el.classList.toggle('checked');
    const val = el.dataset.value;

    if (val === 'ninguna') {
        // Desmarcar todas las demás
        document.querySelectorAll('.checkbox-item[data-value!="ninguna"]').forEach(i => i.classList.remove('checked'));
        formData.health_conditions = el.classList.contains('checked') ? ['ninguna'] : [];
    } else {
        // Desmarcar "ninguna"
        document.querySelector('.checkbox-item[data-value="ninguna"]')?.classList.remove('checked');
        formData.health_conditions = formData.health_conditions.filter(v => v !== 'ninguna');
        if (el.classList.contains('checked')) {
            formData.health_conditions.push(val);
        } else {
            formData.health_conditions = formData.health_conditions.filter(v => v !== val);
        }
    }
}

function updateSlider(el) {
    document.getElementById('trainingDaysVal').textContent = `${el.value} día${el.value > 1 ? 's' : ''}`;
    formData.training_days = parseInt(el.value);
}

// ═══ Registro de usuario ═════════════════════════════════════
async function registerUser() {
    showLoading('Creando tu cuenta...');
    try {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: formData.name,
                email: formData.email,
                password: formData.password,
            }),
        });
        const data = await res.json();
        if (!res.ok) {
            hideLoading();
            const alertEl = document.getElementById('alert-7');
            alertEl.textContent = data.error || (data.errors ? data.errors[0].msg : 'Error al registrar');
            alertEl.style.display = 'block';
            goToStep(1);
            return;
        }
        authToken = data.token;
        localStorage.setItem('nutrovia_token', data.token);
        localStorage.setItem('nutrovia_user', JSON.stringify(data.user));

        // Guardar cuestionario
        await submitQuestionnaire();
        // Inicializar Stripe ahora que tenemos token
        await initStripe();
    } catch (err) {
        console.error(err);
    } finally {
        hideLoading();
    }
}

// ═══ Envío del cuestionario ══════════════════════════════════
async function submitQuestionnaire() {
    try {
        await fetch('/api/questionnaire', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
            },
            body: JSON.stringify({
                age: formData.age,
                sex: formData.sex,
                weight_kg: formData.weight,
                height_cm: formData.height,
                target_weight_kg: formData.targetWeight,
                goal: formData.goal,
                activity_level: formData.activity_level,
                dietary_preference: formData.dietary_preference,
                health_conditions: formData.health_conditions.filter(c => c !== 'ninguna'),
                training_experience: formData.training_experience || 'principiante',
                training_days_per_week: formData.training_days,
            }),
        });
    } catch (err) {
        console.error('Error enviando cuestionario:', err);
    }
}

// ═══ Pago y activación de suscripción ═══════════════════════
async function handlePaymentAndSubmit() {
    const payBtn = document.getElementById('payBtn');
    const alertEl = document.getElementById('alert-7');
    payBtn.disabled = true;
    alertEl.style.display = 'none';

    if (!stripe || !cardElement) {
        alertEl.textContent = 'El formulario de pago no está listo. Espera un momento.';
        alertEl.style.display = 'block';
        payBtn.disabled = false;
        return;
    }

    showLoading('Procesando tu suscripción...');

    try {
        // Confirmar Setup Intent con la tarjeta
        const { setupIntent, error } = await stripe.confirmCardSetup(window._stripeSetupClientSecret, {
            payment_method: { card: cardElement },
        });

        if (error) {
            alertEl.textContent = error.message;
            alertEl.style.display = 'block';
            payBtn.disabled = false;
            hideLoading();
            return;
        }

        // Iniciar suscripción con el método de pago
        const subRes = await fetch('/api/subscription/start', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
            },
            body: JSON.stringify({ payment_method_id: setupIntent.payment_method }),
        });
        const subData = await subRes.json();

        if (!subRes.ok) {
            alertEl.textContent = subData.error || 'Error al activar la suscripción';
            alertEl.style.display = 'block';
            payBtn.disabled = false;
            hideLoading();
            return;
        }

        // Mostrar pantalla de éxito
        showSuccess(subData);
        goToStep(8);

    } catch (err) {
        alertEl.textContent = 'Error inesperado. Inténtalo de nuevo.';
        alertEl.style.display = 'block';
        payBtn.disabled = false;
    } finally {
        hideLoading();
    }
}

function showSuccess(subData) {
    const fmt = (dateStr) => new Date(dateStr).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
    const container = document.getElementById('successDates');
    container.innerHTML = `
    <div class="date-badge">
      <span class="date-label">Prueba gratis hasta</span>
      <span class="date-val">${fmt(subData.trial_end)}</span>
    </div>
    <div class="date-badge">
      <span class="date-label">Cancela antes del</span>
      <span class="date-val">${fmt(subData.cancel_window_end)}</span>
    </div>
    <div class="date-badge">
      <span class="date-label">Cobro si no cancelas</span>
      <span class="date-val">60 €/mes a partir del ${fmt(subData.cancel_window_end)}</span>
    </div>
  `;
}

// ═══ Helpers ════════════════════════════════════════════════
function showLoading(msg = 'Cargando...') {
    document.getElementById('loadingText').textContent = msg;
    document.getElementById('loadingOverlay').style.display = 'flex';
}
function hideLoading() {
    document.getElementById('loadingOverlay').style.display = 'none';
}

// ═══ Init ════════════════════════════════════════════════════
// Si ya tiene sesión, ir directamente al dashboard
if (localStorage.getItem('nutrovia_token')) {
    window.location.href = 'dashboard.html';
}
