// ─── NutroVia — login.js ─────────────────────────────────

// Redirigir si ya tiene sesión
const existingToken = localStorage.getItem('nutrovia_token');
if (existingToken) window.location.href = 'dashboard.html';

const loginForm = document.getElementById('loginForm');
const loginAlert = document.getElementById('login-alert');
const loadingOverlay = document.getElementById('loadingOverlay');

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    if (!email || !password) {
        showAlert(loginAlert, 'Por favor rellena todos los campos.');
        return;
    }

    loadingOverlay.style.display = 'flex';
    loginAlert.style.display = 'none';

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });
        const data = await res.json();

        if (!res.ok) {
            showAlert(loginAlert, data.error || 'Error al iniciar sesión. Verifica tus datos.');
            return;
        }

        localStorage.setItem('nutrovia_token', data.token);
        localStorage.setItem('nutrovia_user', JSON.stringify(data.user));
        window.location.href = 'dashboard.html';

    } catch (err) {
        showAlert(loginAlert, 'Error de conexión. Inténtalo de nuevo.');
    } finally {
        loadingOverlay.style.display = 'none';
    }
});

function showAlert(el, msg) {
    el.textContent = msg;
    el.style.display = 'block';
}
