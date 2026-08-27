// ─── NutroVia — questionnaire.js ────────────────────────────

// ═══ Estado del formulario ═══════════════════════════════════
const formData = {
    name: '', email: '', password: '',
    sex: null, age: null, height: null, weight: null, targetWeight: null,
    goal: null, activity_level: null,
    dietary_preference: null, training_experience: null, training_days: 3,
    training_equipment: 'mixto',
    health_conditions: [],
};

let currentStep = 1;

// ═══ Modo de uso ════════════════════════════════════════════
// - Normal:       registro + tarjeta + prueba gratuita (usuario nuevo)
// - ?update=1:    actualizar valores → regenera el plan (sin pago)
// - ?subscribe=1: re-suscribirse tras cancelar (con pago, sin registro)
const urlParams = new URLSearchParams(window.location.search);
const updateMode = urlParams.get('update') === '1';
const resubMode = urlParams.get('subscribe') === '1';
const loggedIn = !!localStorage.getItem('nutrovia_token');
const isEditFlow = updateMode || resubMode;
const TOTAL_STEPS = updateMode ? 6 : (resubMode ? 7 : 8);
let authToken = null;

// ═══ Estado del pago (Stripe) ═══════════════════════════════
let stripe = null;
let cardElement = null;
let setupClientSecret = null;
let paymentInitialized = false;

// ═══ Navegación entre pasos ═══════════════════════════════════
function goToStep(targetStep) {
    // En modo edición el paso 1 (registro) está oculto
    if (isEditFlow && targetStep < 2) targetStep = 2;

    if (!validateStep(currentStep)) return;
    if (targetStep > currentStep) collectStepData(currentStep);

    document.getElementById(`step-${currentStep}`).style.display = 'none';
    currentStep = targetStep;
    document.getElementById(`step-${currentStep}`).style.display = 'block';
    updateProgress();

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateProgress() {
    // La pantalla de éxito (paso 8) siempre muestra la barra completa
    if (currentStep >= 8) {
        document.getElementById('progressBar').style.width = '100%';
        document.getElementById('progressText').textContent = '¡Plan listo!';
        return;
    }
    const stepIndex = isEditFlow ? currentStep - 1 : currentStep;
    const pct = Math.min(100, Math.round((stepIndex / TOTAL_STEPS) * 100));
    document.getElementById('progressBar').style.width = `${pct}%`;
    document.getElementById('progressText').textContent = `Paso ${stepIndex} de ${TOTAL_STEPS}`;
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
            if (!formData.training_equipment) return showAlert('Selecciona dónde entrenas.');
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
        // Desmarcar todas las demás (el selector != no es válido en querySelectorAll)
        document.querySelectorAll('.checkbox-item:not([data-value="ninguna"])').forEach(i => i.classList.remove('checked'));
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

// ═══ Rellenar formulario con los datos actuales (modo edición) ═
async function prefillForm() {
    try {
        const res = await fetch('/api/plan', {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        if (!res.ok) return;
        const data = await res.json();
        const p = data.profile || {};

        formData.sex = p.sex;
        formData.goal = p.goal;
        formData.activity_level = p.activity_level;
        formData.dietary_preference = p.dietary_preference;
        formData.training_experience = p.training_experience || 'principiante';
        formData.training_days = p.training_days_per_week || 3;
        formData.training_equipment = p.training_equipment || 'mixto';

        // Marcar opciones seleccionadas
        [['sex', p.sex], ['goal', p.goal], ['activity_level', p.activity_level],
         ['dietary_preference', p.dietary_preference], ['training_experience', formData.training_experience],
         ['training_equipment', formData.training_equipment]]
            .forEach(([field, value]) => {
                if (!value) return;
                document.querySelectorAll('.option-btn').forEach(btn => {
                    if ((btn.getAttribute('onclick') || '').includes(`'${field}', '${value}'`)) {
                        btn.classList.add('selected');
                    }
                });
            });

        // Campos numéricos
        if (p.age) document.getElementById('q-age').value = p.age;
        if (p.height_cm) document.getElementById('q-height').value = p.height_cm;
        if (p.weight_kg) document.getElementById('q-weight').value = p.weight_kg;
        if (p.target_weight_kg) document.getElementById('q-target-weight').value = p.target_weight_kg;

        // Condiciones de salud
        if (Array.isArray(p.health_conditions)) {
            p.health_conditions.forEach(v => {
                document.querySelector(`.checkbox-item[data-value="${v}"]`)?.classList.add('checked');
            });
            formData.health_conditions = p.health_conditions.filter(c => c !== 'ninguna');
        }

        // Días de entrenamiento
        const slider = document.getElementById('trainingDays');
        slider.value = formData.training_days;
        document.getElementById('trainingDaysVal').textContent =
            `${formData.training_days} día${formData.training_days > 1 ? 's' : ''}`;
    } catch (err) {
        console.error('Error rellenando formulario:', err);
    }
}

// ═══ Registro / actualización de usuario ═════════════════════
async function registerUser() {
    if (isEditFlow) {
        // Ya estamos registrados: solo actualizar el cuestionario
        showLoading(updateMode ? 'Actualizando tu plan...' : 'Guardando tus datos...');
        try {
            authToken = localStorage.getItem('nutrovia_token');
            await submitQuestionnaire();
            if (updateMode) {
                document.getElementById('successText').innerHTML =
                    'Hemos actualizado tu plan con tus nuevos datos. Tu menú semanal, tu rutina de entrenamiento y tu suplementación ya se han recalculado.';
                goToStep(8);
            } else {
                // Re-suscripción: ir a guardar tarjeta
                goToStep(7);
                initPayment();
            }
        } catch (err) {
            console.error(err);
            const alertEl = document.getElementById('alert-6');
            if (alertEl) {
                alertEl.textContent = 'Hubo un error actualizando tus datos. Inténtalo de nuevo.';
                alertEl.style.display = 'block';
            }
        } finally {
            hideLoading();
        }
        return;
    }

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
            // Mostrar el error en el paso visible (6, donde está el botón) —
            // no en un mensaje oculto de otro paso
            const alertEl = document.getElementById('alert-6');
            const baseMsg = data.error || (data.errors ? data.errors.map(e => e.msg).join(' · ') : 'Error al registrar. Inténtalo de nuevo.');
            alertEl.textContent = baseMsg;
            if (res.status === 409) {
                alertEl.appendChild(document.createTextNode(' '));
                const loginLink = document.createElement('a');
                loginLink.href = 'login.html';
                loginLink.textContent = 'Inicia sesión aquí';
                loginLink.style.color = 'var(--gold)';
                loginLink.style.textDecoration = 'underline';
                alertEl.appendChild(loginLink);
            }
            alertEl.style.display = 'block';
            return;
        }
        authToken = data.token;
        localStorage.setItem('nutrovia_token', data.token);
        localStorage.setItem('nutrovia_user', JSON.stringify(data.user));

        // Guardar cuestionario
        await submitQuestionnaire();

        // Ir a la pantalla de pago (guardar tarjeta + activar prueba gratuita)
        goToStep(7);
        initPayment();
    } catch (err) {
        console.error(err);
        const alertEl = document.getElementById('alert-6') || document.getElementById('alert-5');
        if (alertEl) {
            alertEl.textContent = 'Hubo un error inesperado. Inténtalo de nuevo.';
            alertEl.style.display = 'block';
        }
    } finally {
        hideLoading();
    }
}

// ═══ Envío del cuestionario ══════════════════════════════════
async function submitQuestionnaire() {
    try {
        const res = await fetch('/api/questionnaire', {
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
                training_equipment: formData.training_equipment || 'mixto',
            }),
        });

        if (!res.ok) {
            const data = await res.json();
            throw new Error(JSON.stringify(data));
        }
    } catch (err) {
        console.error('Error enviando cuestionario:', err);
        throw err;
    }
}

// ═══ Stripe: guardar tarjeta + activar prueba gratuita ═══════
async function initPayment() {
    if (paymentInitialized) return;
    paymentInitialized = true;

    if (typeof Stripe === 'undefined') {
        const alertEl = document.getElementById('alert-7');
        alertEl.textContent = 'No se pudo cargar el sistema de pago seguro. Recarga la página e inténtalo de nuevo.';
        alertEl.style.display = 'block';
        return;
    }

    try {
        const res = await fetch('/api/subscription/setup-intent', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` },
        });
        const data = await res.json();

        if (!res.ok) {
            const alertEl = document.getElementById('alert-7');
            alertEl.textContent = data.error || 'No se pudo preparar el pago. Inténtalo en unos minutos.';
            alertEl.style.display = 'block';
            return;
        }

        setupClientSecret = data.client_secret;
        stripe = Stripe(data.publishable_key);
        cardElement = stripe.elements().create('card', {
            style: {
                base: {
                    color: '#e8e0d0',
                    fontFamily: "'Outfit', sans-serif",
                    fontSize: '16px',
                    '::placeholder': { color: '#888880' },
                },
                invalid: { color: '#e55b5b' },
            },
        });
        cardElement.mount('#card-element');
        cardElement.on('change', (e) => {
            const errEl = document.getElementById('card-errors');
            if (e.error) {
                errEl.textContent = e.error.message;
                errEl.style.display = 'block';
            } else {
                errEl.style.display = 'none';
            }
        });
    } catch (err) {
        console.error('Error iniciando pago:', err);
        paymentInitialized = false;
    }
}

async function startTrial() {
    const alertEl = document.getElementById('alert-7');
    const errEl = document.getElementById('card-errors');
    [alertEl, errEl].forEach(el => { if (el) el.style.display = 'none'; });

    if (!stripe || !cardElement || !setupClientSecret) {
        alertEl.textContent = 'El formulario de pago aún no está listo. Espera un momento e inténtalo de nuevo.';
        alertEl.style.display = 'block';
        return;
    }

    showLoading('Guardando tu tarjeta de forma segura...');
    try {
        const { error, setupIntent } = await stripe.confirmCardSetup(setupClientSecret, {
            payment_method: {
                card: cardElement,
                billing_details: { name: formData.name, email: formData.email },
            },
        });

        if (error) {
            errEl.textContent = error.message;
            errEl.style.display = 'block';
            hideLoading();
            return;
        }

        const res = await fetch('/api/subscription/start', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
            },
            body: JSON.stringify({ payment_method_id: setupIntent.payment_method }),
        });
        const data = await res.json();

        if (!res.ok) {
            alertEl.textContent = data.error || 'Error al iniciar la prueba gratuita.';
            alertEl.style.display = 'block';
            hideLoading();
            return;
        }

        // ¡Prueba gratuita activada!
        goToStep(8);
    } catch (err) {
        console.error('Error en startTrial:', err);
        alertEl.textContent = 'Hubo un error de conexión. Inténtalo de nuevo.';
        alertEl.style.display = 'block';
    } finally {
        hideLoading();
    }
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
if (loggedIn) {
    if (!isEditFlow) {
        // Si ya tiene sesión y entra normal, ir directamente al dashboard
        window.location.href = 'dashboard.html';
    } else {
        // Modo edición: saltar el registro y rellenar con los datos actuales
        authToken = localStorage.getItem('nutrovia_token');
        const storedUser = JSON.parse(localStorage.getItem('nutrovia_user') || '{}');
        formData.name = storedUser.name || '';
        formData.email = storedUser.email || '';

        document.getElementById('submitBtn').textContent = updateMode ? 'Actualizar mi plan' : 'Continuar al pago';
        document.getElementById('step-1').style.display = 'none';
        currentStep = 2;
        document.getElementById('step-2').style.display = 'block';
        updateProgress();
        prefillForm();
    }
}
