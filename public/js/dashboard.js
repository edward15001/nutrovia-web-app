// ─── NutroVia — dashboard.js ─────────────────────────────────

const token = localStorage.getItem('nutrovia_token');
const user = JSON.parse(localStorage.getItem('nutrovia_user') || '{}');

// Redirigir si no hay sesión
if (!token) window.location.href = 'login.html';

let planData = null;
let subData = null;
let currentDay = 'Lunes';

// ═══ Init ════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  initTopbar();
  await Promise.all([loadPlan(), loadSubscription()]);
  renderDashboard();
  hideLoading();
});

function initTopbar() {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches';
  document.getElementById('dashGreeting').textContent = `${greeting}, ${user.name?.split(' ')[0] || ''}`;
  document.getElementById('dashDate').textContent = new Date().toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  // Sidebar user info
  document.getElementById('sidebarName').textContent = user.name || '';
  document.getElementById('sidebarEmail').textContent = user.email || '';
  const initials = (user.name || 'N').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  document.getElementById('sidebarAvatar').textContent = initials;

  // Mobile menu button
  const mobileBtn = document.getElementById('mobileMenuBtn');
  mobileBtn.style.display = 'flex';

  // Responsive
  if (window.innerWidth <= 768) mobileBtn.style.display = 'flex';
}

// ═══ Cargar plan ════════════════════════════════════════════
async function loadPlan() {
  try {
    const res = await fetch('/api/plan', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      if (res.status === 404) {
        // No tiene plan aún
        showNoPlanMessage();
        return;
      }
      throw new Error('Error cargando plan');
    }
    planData = await res.json();
  } catch (err) {
    console.error(err);
  }
}

// ═══ Cargar suscripción ══════════════════════════════════════
async function loadSubscription() {
  try {
    const res = await fetch('/api/subscription/status', {
      headers: { Authorization: `Bearer ${token}` }
    });
    subData = await res.json();
  } catch (err) {
    console.error('Error cargando suscripción:', err);
  }
}

// ═══ Renderizado principal ═══════════════════════════════════
function renderDashboard() {
  renderStatusBanner();
  if (planData) {
    renderOverview();
    renderNutritionTab();
    renderTrainingTab();
    renderSupplementsTab();
  }
  renderSubscriptionTab();

}

// ─── Status Banner ───────────────────────────────────────────
function renderStatusBanner() {
  const banner = document.getElementById('statusBanner');
  const badge = document.getElementById('bannerBadge');
  const title = document.getElementById('bannerTitle');
  const subtitle = document.getElementById('bannerSubtitle');
  const action = document.getElementById('bannerAction');

  if (!subData || subData.status === 'none') {
    banner.style.display = 'none';
    return;
  }

  banner.style.display = 'flex';

  if (subData.status === 'trial') {
    if (subData.phase === 'prueba_gratuita') {
      banner.className = 'status-banner trial';
      badge.textContent = 'PRUEBA GRATUITA';
      title.textContent = `Quedan ${subData.days_remaining_trial} días de prueba gratis`;
      subtitle.textContent = `Prueba sin coste hasta el ${fmt(subData.trial_end)}. Luego tienes 15 días más para cancelar.`;
      action.innerHTML = `<button class="btn-cancel" onclick="handleCancel()">Cancelar suscripción</button>`;
    } else if (subData.phase === 'ventana_cancelacion') {
      banner.className = 'status-banner warning';
      badge.textContent = 'VENTANA DE CANCELACIÓN';
      title.textContent = `Quedan ${subData.days_to_charge} días para cancelar sin cargo`;
      subtitle.textContent = `El ${fmt(subData.cancel_window_end)} se activará tu suscripción de 60 €/mes si no cancelas antes.`;
      action.innerHTML = `<button class="btn-cancel" onclick="handleCancel()">Cancelar ahora</button>`;
    }
  } else if (subData.status === 'active') {
    banner.className = 'status-banner active';
    badge.textContent = 'SUSCRIPCIÓN ACTIVA';
    title.textContent = `Próximo cobro: ${fmt(subData.next_billing_date)}`;
    subtitle.textContent = '60 € · Pago mensual automático';
    action.innerHTML = `<button class="btn-cancel" onclick="showTab('subscription', null)">Ver detalles</button>`;
  } else if (subData.status === 'cancelled') {
    banner.className = 'status-banner cancelled';
    badge.textContent = 'CANCELADA';
    title.textContent = 'Suscripción cancelada';
    subtitle.textContent = `Acceso hasta el ${fmt(subData.cancelled_at)}. Puedes volver cuando quieras.`;
    action.innerHTML = '';
  } else if (subData.status === 'past_due') {
    banner.className = 'status-banner cancelled';
    badge.textContent = 'PAGO PENDIENTE';
    title.textContent = 'Pago fallido';
    subtitle.textContent = 'Actualiza tu método de pago para continuar con tu plan.';
    action.innerHTML = '';
  }
}

// ─── Overview Tab ────────────────────────────────────────────
function renderOverview() {
  const { daily_calories, protein_g, carbs_g, fat_g, profile } = planData;
  const totalMacroG = protein_g + carbs_g + fat_g;

  // Macro cards
  document.getElementById('macroCards').innerHTML = `
    <div class="dash-card">
      <div class="dash-card-label">Calorías diarias</div>
      <div><span class="dash-card-value">${daily_calories}</span><span class="dash-card-unit">kcal</span></div>
      <div class="dash-card-sub">Tu objetivo calórico personalizado</div>
    </div>
    <div class="dash-card">
      <div class="dash-card-label">Proteína</div>
      <div><span class="dash-card-value">${protein_g}</span><span class="dash-card-unit">g/día</span></div>
      <div class="dash-card-sub">${Math.round((protein_g * 4 / daily_calories) * 100)}% de las calorías</div>
    </div>
    <div class="dash-card">
      <div class="dash-card-label">Carbohidratos</div>
      <div><span class="dash-card-value">${carbs_g}</span><span class="dash-card-unit">g/día</span></div>
      <div class="dash-card-sub">${Math.round((carbs_g * 4 / daily_calories) * 100)}% de las calorías</div>
    </div>
  `;

  // Macro bars
  document.getElementById('macroBars').innerHTML = `
    <div class="macro-bar-item">
      <div class="macro-head"><span class="macro-name">💧 Proteína</span><span class="macro-val">${protein_g}g</span></div>
      <div class="macro-bar-bg"><div class="macro-bar-fill protein" style="width:${Math.round(protein_g / totalMacroG * 100)}%"></div></div>
    </div>
    <div class="macro-bar-item">
      <div class="macro-head"><span class="macro-name">⚡ Carbohidratos</span><span class="macro-val">${carbs_g}g</span></div>
      <div class="macro-bar-bg"><div class="macro-bar-fill carbs" style="width:${Math.round(carbs_g / totalMacroG * 100)}%"></div></div>
    </div>
    <div class="macro-bar-item">
      <div class="macro-head"><span class="macro-name">🥑 Grasas</span><span class="macro-val">${fat_g}g</span></div>
      <div class="macro-bar-bg"><div class="macro-bar-fill fat" style="width:${Math.round(fat_g / totalMacroG * 100)}%"></div></div>
    </div>
  `;

  // Profile info
  const goalLabels = {
    perder_peso: '🔥 Perder peso', ganar_masa: '💪 Ganar masa', mantener: '⚖️ Mantener', mejorar_salud: '❤️ Mejorar salud'
  };
  const actLabels = { sedentario: 'Sedentario', ligero: 'Ligero', moderado: 'Moderado', activo: 'Activo', muy_activo: 'Muy activo' };
  document.getElementById('profileInfo').innerHTML = `
    <div style="display:flex;flex-direction:column;gap:8px;font-size:13px;color:var(--text-muted);">
      <div>🎯 <strong>Objetivo:</strong> ${goalLabels[profile.goal] || profile.goal}</div>
      <div>⚡ <strong>Actividad:</strong> ${actLabels[profile.activity_level] || profile.activity_level}</div>
      <div>⚖️ <strong>Peso:</strong> ${profile.weight_kg} kg</div>
      <div>📏 <strong>Altura:</strong> ${profile.height_cm} cm</div>
      <div>🎂 <strong>Edad:</strong> ${profile.age} años</div>
    </div>
  `;

  // Tips
  const tips = planData.consejos_generales || [];
  document.getElementById('tipsCard').innerHTML = `
    <div class="dash-card-label">💡 Consejos generales</div>
    <div style="margin-top:16px;display:grid;grid-template-columns:1fr 1fr;gap:10px;">
      ${tips.map(t => `<div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:12px;font-size:13px;color:var(--text-muted);">${t}</div>`).join('')}
    </div>
  `;
}

// ─── Nutrition Tab ───────────────────────────────────────────
function renderNutritionTab() {
  renderDayMenu('Lunes');
}

function switchDayTab(btn, day) {
  document.querySelectorAll('#tab-nutrition .tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentDay = day;
  renderDayMenu(day);
}

function renderDayMenu(day) {
  const menu = planData?.weekly_menu?.[day];
  if (!menu) {
    document.getElementById('dayMenuContent').innerHTML = '<p style="color:var(--text-muted);padding:20px">No hay menú disponible para este día.</p>';
    return;
  }

  const meals = [
    { key: 'desayuno', label: '🌅 Desayuno' },
    { key: 'almuerzo', label: '☕ Almuerzo' },
    { key: 'comida', label: '🍽️ Comida' },
    { key: 'merienda', label: '🍎 Merienda' },
    { key: 'cena', label: '🌙 Cena' },
  ];

  document.getElementById('dayMenuContent').innerHTML = `
    <div class="dash-card-label" style="margin-bottom:20px;">${day} — ${planData.daily_calories} kcal totales</div>
    ${meals.map(meal => {
    const m = menu[meal.key];
    if (!m) return '';
    return `
        <div style="border-bottom:1px solid var(--border);padding:16px 0;display:grid;grid-template-columns:120px 1fr;gap:20px;align-items:start;">
          <div style="font-size:13px;color:var(--gold);font-weight:700;">${meal.label}<br><span style="color:var(--text-dim);font-weight:400;">${m.calorias} kcal</span></div>
          <div>
            <div style="font-size:15px;font-weight:700;margin-bottom:6px;">${m.nombre}</div>
            <div style="font-size:12px;color:var(--text-muted);">${Array.isArray(m.ingredientes) ? m.ingredientes.join(' · ') : ''}</div>
          </div>
        </div>
      `;
  }).join('')}
  `;
}

// ─── Training Tab ────────────────────────────────────────────
function renderTrainingTab() {
  const tp = planData?.training_plan;
  if (!tp) return;

  document.getElementById('trainingHeader').innerHTML = `
    <div style="display:flex;gap:20px;align-items:center;flex-wrap:wrap;">
      <div>
        <div class="dash-card-label">Tu rutina de entrenamiento</div>
        <div style="font-size:20px;font-weight:800;margin-top:6px;">${capitalizeFirst(tp.objetivo)} — Nivel ${capitalizeFirst(tp.nivel)}</div>
      </div>
      <div style="margin-left:auto;display:flex;gap:12px;flex-wrap:wrap;">
        <div class="date-badge"><span class="date-label">Días/semana</span><span class="date-val">${tp.dias_semana}</span></div>
      </div>
    </div>
  `;

  const sessions = tp.sesiones || [];
  document.getElementById('trainingGrid').innerHTML = sessions.map(s => `
    <div class="training-session">
      <div class="session-day-badge">
        ${s.dia}
        <span class="session-tipo">${s.tipo}</span>
      </div>
      <div class="session-exercises">
        <div class="session-title">${s.tipo}</div>
        <div class="exercise-list">
          ${(s.ejercicios || []).map(e => `<span class="exercise-tag">${e}</span>`).join('')}
        </div>
      </div>
    </div>
  `).join('');

  const notes = tp.notas || [];
  document.getElementById('trainingNotes').innerHTML = `
    <div class="dash-card-label">📌 Notas importantes</div>
    <div style="margin-top:14px;display:flex;flex-direction:column;gap:8px;">
      ${notes.map(n => `<div style="font-size:13px;color:var(--text-muted);padding:10px 14px;background:var(--bg);border-radius:8px;border-left:3px solid var(--gold);">${n}</div>`).join('')}
    </div>
  `;
}

// ─── Supplements Tab ─────────────────────────────────────────
function renderSupplementsTab() {
  const supps = planData?.supplements || [];
  const icons = ['💊', '🌿', '⚡', '🥤', '💉', '🌱', '🔬'];
  document.getElementById('suppsGrid').innerHTML = supps.map((s, i) => `
    <div class="supp-card">
      <div class="supp-icon">${icons[i % icons.length]}</div>
      <div>
        <div class="supp-name">${s.nombre}</div>
        <div class="supp-dosis">📏 ${s.dosis}</div>
        <div class="supp-motivo">${s.motivo}</div>
      </div>
    </div>
  `).join('');
}

// ─── Subscription Tab ────────────────────────────────────────
function renderSubscriptionTab() {
  if (!subData || subData.status === 'none') {
    document.getElementById('subDetail').innerHTML = `
      <div class="dash-card-label">Estado de suscripción</div>
      <p style="color:var(--text-muted);margin-top:12px;font-size:14px;">No tienes ninguna suscripción activa.</p>
      <a href="questionnaire.html" class="btn-gold" style="display:inline-flex;margin-top:16px;">Activar plan</a>
    `;
    return;
  }

  const {
    status, trial_start, trial_end, cancel_window_end,
    next_billing_date, charge_day, cancelled_at
  } = subData;

  const statusLabels = {
    trial: '🟡 Período de prueba',
    active: '🟢 Activa',
    cancelled: '🔴 Cancelada',
    expired: '⚫ Expirada',
    past_due: '🟠 Pago pendiente',
  };

  document.getElementById('subDetail').innerHTML = `
    <div class="dash-card-label">Detalles de suscripción</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-top:20px;">
      <div class="date-badge"><span class="date-label">Estado</span><span class="date-val" style="font-size:13px;">${statusLabels[status] || status}</span></div>
      ${trial_start ? `<div class="date-badge"><span class="date-label">Inicio prueba</span><span class="date-val">${fmt(trial_start)}</span></div>` : ''}
      ${trial_end ? `<div class="date-badge"><span class="date-label">Fin prueba</span><span class="date-val">${fmt(trial_end)}</span></div>` : ''}
      ${cancel_window_end ? `<div class="date-badge"><span class="date-label">Cancela antes del</span><span class="date-val">${fmt(cancel_window_end)}</span></div>` : ''}
      ${next_billing_date ? `<div class="date-badge"><span class="date-label">Próximo cobro</span><span class="date-val">${fmt(next_billing_date)}</span></div>` : ''}
      ${charge_day ? `<div class="date-badge"><span class="date-label">Día de cobro mensual</span><span class="date-val">Día ${charge_day}</span></div>` : ''}
      ${cancelled_at ? `<div class="date-badge"><span class="date-label">Cancelada el</span><span class="date-val">${fmt(cancelled_at)}</span></div>` : ''}
    </div>
    <div style="margin-top:28px;display:flex;gap:16px;flex-wrap:wrap;align-items:center;">
      <div style="flex:1;">
        <div style="font-size:22px;font-weight:800;color:var(--gold);">60 €<span style="font-size:14px;color:var(--text-muted);font-weight:400;">/mes</span></div>
        <div style="font-size:12px;color:var(--text-dim);margin-top:4px;">Plan NutroVia Personalizado</div>
      </div>
      ${status !== 'cancelled' && status !== 'expired' ? `
        <button class="btn-cancel" onclick="handleCancel()">Cancelar suscripción</button>
      ` : `
        <a href="questionnaire.html" class="btn-gold">Volver a suscribirme</a>
      `}
    </div>
  `;
}

// ═══ Cancelar suscripción ════════════════════════════════════
async function handleCancel() {
  if (!confirm('¿Estás seguro de que quieres cancelar tu suscripción? Perderás acceso al plan.')) return;

  try {
    const res = await fetch('/api/subscription/cancel', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();

    if (!res.ok) {
      alert(data.error || 'Error al cancelar');
      return;
    }

    alert(`Suscripción cancelada. Fecha efectiva: ${fmt(data.effective_date)}`);
    await loadSubscription();
    renderStatusBanner();
    renderSubscriptionTab();
  } catch (err) {
    alert('Error de conexión');
  }
}

// ═══ Tabs ════════════════════════════════════════════════════
function showTab(tabId, linkEl) {
  ['overview', 'nutrition', 'training', 'supplements', 'subscription'].forEach(id => {
    document.getElementById(`tab-${id}`).style.display = id === tabId ? 'block' : 'none';
  });
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
  if (linkEl) linkEl.classList.add('active');
  // Auto-cerrar sidebar en mobile
  if (window.innerWidth <= 768) document.getElementById('sidebar').classList.remove('open');
  return false;
}

// ═══ Utils ═══════════════════════════════════════════════════
function fmt(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}

function capitalizeFirst(str = '') {
  return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, ' ');
}

function hideLoading() {
  document.getElementById('loadingOverlay').style.display = 'none';
}

function showNoPlanMessage() {
  const main = document.querySelector('.dashboard-main');
  main.innerHTML = `
    <div style="text-align:center;padding:80px 24px;">
      <div style="font-size:48px;margin-bottom:20px;">📋</div>
      <h2 style="font-size:24px;font-weight:800;margin-bottom:10px;">Aún no tienes un plan</h2>
      <p style="color:var(--text-muted);margin-bottom:28px;">Completa el cuestionario para recibir tu plan personalizado</p>
      <a href="questionnaire.html" class="btn-gold-large">Crear mi plan →</a>
    </div>
  `;
}

function logout() {
  localStorage.removeItem('nutrovia_token');
  localStorage.removeItem('nutrovia_user');
  window.location.href = 'index.html';
}
