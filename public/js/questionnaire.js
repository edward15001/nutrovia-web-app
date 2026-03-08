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
const TOTAL_STEPS = 7;
let authToken = null;

// ═══ Navegación entre pasos ═══════════════════════════════════
function goToStep(targetStep) {
    if (!validateStep(currentStep)) return;
    if (targetStep > currentStep) collectStepData(currentStep);

    document.getElementById(`step-${currentStep}`).style.display = 'none';
    currentStep = targetStep;
    document.getElementById(`step-${currentStep}`).style.display = 'block';
    updateProgress();

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

        // Ir a la pantalla de éxito directamente
        goToStep(7);
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

        if (!res.ok) {
            const data = await res.json();
            throw new Error(JSON.stringify(data));
        }
    } catch (err) {
        console.error('Error enviando cuestionario:', err);
        throw err;
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
// Si ya tiene sesión, ir directamente al dashboard
if (localStorage.getItem('nutrovia_token')) {
    window.location.href = 'dashboard.html';
}
