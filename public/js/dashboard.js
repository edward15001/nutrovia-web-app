// ─── NutroVia — dashboard.js ─────────────────────────────────

// Helper de iconos SVG (definido en js/icons.js)
const ICON = (n, s) => (window.NV && NV.icon) ? `<span class="nv-icon">${NV.icon(n, s || 14)}</span>` : '';

const token = localStorage.getItem('nutrovia_token');
const user = JSON.parse(localStorage.getItem('nutrovia_user') || '{}');

// Redirigir si no hay sesión
if (!token) window.location.href = 'login.html';

let planData = null;
let subData = null;
let paymentHistory = [];

// ¿El usuario tiene acceso PRO? Proviene del campo access de /api/plan;
// para planes antiguos sin acceso, se deriva del estado de la suscripción.
function isProUser() {
  if (planData && planData.access) return planData.access.isPro;
  const s = subData;
  return !!s && ['trial', 'active', 'past_due'].includes(s.status);
}

// ═══ Init ════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  initTopbar();
  try {
    await Promise.all([loadPlan(), loadSubscription(), loadPaymentHistory()]);
    renderDashboard();
    // Check-in semanal: preguntar si lleva 7+ días sin actividad
    await checkCheckin();
  } catch (err) {
    console.error('Error inicializando el dashboard:', err);
    showDashboardError(err?.message || 'No se pudo cargar tu panel. Recarga la página e inténtalo de nuevo.');
  } finally {
    hideLoading();
  }
});

const DASHBOARD_REQUEST_TIMEOUT_MS = 15000;

async function fetchDashboard(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DASHBOARD_REQUEST_TIMEOUT_MS);
  try {
    return await fetch(path, { ...options, signal: controller.signal });
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error('La carga está tardando demasiado. Comprueba tu conexión e inténtalo de nuevo.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

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
    const res = await fetchDashboard('/api/plan', {
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
    throw err;
  }
}

// ═══ Cargar suscripción ══════════════════════════════════════
async function loadSubscription() {
  try {
    const res = await fetchDashboard('/api/subscription/status', {
      headers: { Authorization: `Bearer ${token}` }
    });
    subData = await res.json();
  } catch (err) {
    console.error('Error cargando suscripción:', err);
    subData = { status: 'none' };
  }
}

// ═══ Cargar historial de pagos ═══════════════════════════════
async function loadPaymentHistory() {
  try {
    const res = await fetchDashboard('/api/subscription/history', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return;
    const data = await res.json();
    paymentHistory = data.payments || [];
  } catch (err) {
    console.error('Error cargando historial de pagos:', err);
    paymentHistory = [];
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
      badge.textContent = 'PLAN PRO ACTIVO';
      title.textContent = subData.trial_end ? `Próximo cobro: ${fmt(subData.trial_end)}` : 'Pro activo';
      subtitle.textContent = '14 € · Pago mensual. Deja de pagar cuando quieras y vuelves al plan gratuito.';
      action.innerHTML = `<button class="btn-cancel" onclick="handleCancel()">Dejar de pagar</button>`;
    } else if (subData.phase === 'ventana_cancelacion') {
      banner.className = 'status-banner warning';
      badge.textContent = 'PRO ACTIVO';
      title.textContent = 'Tu plan Pro está activo';
      subtitle.textContent = '14 € · Pago mensual. Deja de pagar cuando quieras y vuelves al plan gratuito.';
      action.innerHTML = `<button class="btn-cancel" onclick="handleCancel()">Dejar de pagar</button>`;
    }
  } else if (subData.status === 'active') {
    banner.className = 'status-banner active';
    badge.textContent = 'PLAN PRO ACTIVO';
    title.textContent = subData.next_billing_date ? `Próximo cobro: ${fmt(subData.next_billing_date)}` : 'Pro activo';
    subtitle.textContent = '14 € · Pago mensual. Deja de pagar cuando quieras y vuelves al plan gratuito.';
    action.innerHTML = `<button class="btn-cancel" onclick="showTab('subscription', null)">Ver suscripción</button>`;
  } else if (subData.status === 'cancelled' || subData.status === 'expired') {
    banner.className = 'status-banner free';
    badge.textContent = 'PLAN GRATUITO';
    title.textContent = 'Estás en el plan gratuito';
    subtitle.textContent = 'Gratis para siempre. Actualiza a Pro cuando quieras.';
    action.innerHTML = `<button class="btn-gold" onclick="openUpgrade()">Actualizar a Pro</button>`;
  } else if (subData.status === 'past_due') {
    banner.className = 'status-banner warning';
    badge.textContent = 'PAGO PENDIENTE';
    title.textContent = 'Pago fallido';
    subtitle.textContent = 'Actualiza tu método de pago para continuar con tu plan.';
    action.innerHTML = '';
  }
}

// ─── Overview Tab (Bento Grid estilo dashboard premium) ──────

// Día seleccionado en el gráfico de calorías (null = media semanal)
let weekSelDay = null;

function selectWeekDay(i) {
  weekSelDay = (weekSelDay === i) ? null : i;
  renderOverview();
}

function renderOverview() {
  const { daily_calories, protein_g, carbs_g, fat_g, profile } = planData;
  const kcalBase = daily_calories || 1;
  const totalMacroG = protein_g + carbs_g + fat_g;
  const goalLabels = { perder_peso: 'Perder peso', ganar_masa: 'Ganar masa', mantener: 'Mantener', mejorar_salud: 'Mejorar salud' };
  const actLabels = { sedentario: 'Sedentario', ligero: 'Ligero', moderado: 'Moderado', activo: 'Activo', muy_activo: 'Muy activo' };
  const eqLabels = { casa: 'En casa', gimnasio: 'Gimnasio', mixto: 'Mixto' };
  const goal = goalLabels[profile.goal] || profile.goal;
  const tips = planData.consejos_generales || [];
  const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const dayLetters = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

  // kcal por día (desde el menú real de la semana). En modo free el backend
  // envía solo { _kcal } por día ("a oscuras", sin detalle de comidas).
  const weekKcal = days.map(d => {
    const menu = planData?.weekly_menu?.[d] || {};
    if (typeof menu._kcal === 'number') return menu._kcal;
    return Object.values(menu).reduce((sum, m) => sum + (m && m.calorias ? m.calorias : 0), 0);
  });
  const weekAvg = Math.round(weekKcal.reduce((a, b) => a + b, 0) / 7);
  const maxKcal = Math.max.apply(null, weekKcal.concat([kcalBase, 1]));

  // Día seleccionado: muestra las kcal de ese día en vez de la media
  const selIdx = weekSelDay;
  const dispKcal = selIdx === null ? weekAvg : weekKcal[selIdx];

  // Gráfico de línea (viewBox 0 0 120 48)
  const W = 120, H = 48, PAD = 6;
  const chartPts = weekKcal.map((k, i) => [
    PAD + (i * (W - PAD * 2)) / 6,
    H - PAD - (k / maxKcal) * (H - PAD * 2)
  ]);
  const linePath = chartPts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const last = chartPts[chartPts.length - 1];
  const areaPath = linePath + ' L' + last[0].toFixed(1) + ' 48 L' + chartPts[0][0].toFixed(1) + ' 48 Z';
  const goalY = (H - PAD - (kcalBase / maxKcal) * (H - PAD * 2)).toFixed(1);

  // Move ring: 3 aros concéntricos P / C / G
  const circ = r => 2 * Math.PI * r;
  const pFrac = (protein_g * 4) / kcalBase;
  const cFrac = (carbs_g * 4) / kcalBase;
  const gFrac = (fat_g * 9) / kcalBase;
  const ringArc = (r, frac, color, offset) =>
    `<circle cx="60" cy="60" r="${r}" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${(frac * circ(r)).toFixed(1)} ${circ(r).toFixed(1)}" stroke-dashoffset="${offset || 0}" transform="rotate(-90 60 60)"/>`;

  // Días de entreno: sesiones reales del plan, rellenadas hasta los días que
  // el usuario pidió en su perfil (para que el panel reaccione a sus cambios).
  const trainDays = (planData?.training_plan?.sesiones || []).map(s => s.dia);
  const reqDays = Math.min(7, Math.max(1, Number(profile.training_days_per_week) || trainDays.length || 3));
  const activeIdx = [];
  trainDays.forEach(d => { const i = days.indexOf(d); if (i !== -1 && !activeIdx.includes(i)) activeIdx.push(i); });
  for (let fill = 0; activeIdx.length < reqDays && fill < 7; fill++) {
    const candidate = Math.round((fill * 6) / (reqDays - 1 || 1));
    if (!activeIdx.includes(candidate)) activeIdx.push(candidate);
  }
  const activeSet = new Set(activeIdx);

  // Suplementos (top 4) — solo Pro; en free mostramos bloqueo
  const supps = (planData?.supplements || []).slice(0, 4);
  const supIcons = ['supplement', 'leaf', 'zap', 'flask', 'droplet', 'seedling', 'shield'];
  const pct = g => Math.round((g * 4 / kcalBase) * 100);
  const pro = isProUser();
  const supsCard = pro
    ? (supps.length
      ? `<div class="db-sups-row">${supps.map((s, i) => `<div class="db-sup" title="${s.nombre} — ${s.dosis}"><span class="db-sup-circle">${ICON(supIcons[i % supIcons.length], 18)}</span><span class="db-sup-name">${s.nombre}</span></div>`).join('')}</div>`
      : '<p class="db-sub">Sin suplementos en tu plan.</p>')
    : `<div class="db-lock">${ICON('lock', 16)} La suplementación está disponible en <b>Pro</b>.<br><a href="#" class="db-lock-link" onclick="openUpgrade();return false;">Desbloquear a Pro →</a></div>`;

  document.getElementById('dashBento').innerHTML = `
    <!-- 01 · Tu objetivo + move ring -->
    <div class="db-card db-feat">
      <div class="db-feat-txt">
        <span class="db-label">${ICON('target', 13)} Tu objetivo</span>
        <h3 class="db-title">${goal}</h3>
        <p class="db-sub">${tips[0] || 'Tu plan se ajusta cada semana a tu progreso real.'}</p>
        <div class="db-chips">
          <span class="db-chip">${ICON('scale', 13)} ${profile.weight_kg} kg${profile.target_weight_kg ? ' → ' + profile.target_weight_kg + ' kg' : ''}</span>
          <span class="db-chip">${ICON('training', 13)} ${profile.training_days_per_week || 3} días/sem</span>
          <span class="db-chip">${ICON('zap', 13)} ${actLabels[profile.activity_level] || profile.activity_level}</span>
        </div>
        <div class="db-chip-row">
          <span class="db-mini">${ICON('nutrition', 12)} ${eqLabels[profile.training_equipment] || 'Mixto'}</span>
          <span class="db-mini">${ICON('ruler', 12)} ${profile.height_cm} cm</span>
          <span class="db-mini">${ICON('calendar', 12)} ${profile.age} años</span>
        </div>
      </div>
      <div class="db-ring-box">
        <svg viewBox="0 0 120 120" class="db-ring">
          <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="7"/>
          ${ringArc(50, pFrac, '#f0d58c')}
          ${ringArc(40, cFrac, '#c9a84c', (-circ(40) * pFrac).toFixed(1))}
          ${ringArc(30, gFrac, '#9e7f2e', (-circ(30) * (pFrac + cFrac)).toFixed(1))}
        </svg>
        <div class="db-ring-center">
          <span class="db-ring-num">${kcalBase}</span>
          <span class="db-ring-unit">KCAL / DÍA</span>
        </div>
      </div>
    </div>

    <!-- 02 · Consejo de hoy -->
    <div class="db-card db-sparkle">
      <span class="db-sparkle-icon">${ICON('sparkles', 22)}</span>
      <span class="db-label">Consejo de hoy</span>
      <p class="db-quote">${tips[1] || tips[0] || ''}</p>
    </div>

    <!-- 03 · Calorías de la semana -->
    <div class="db-card db-wide">
      <div class="db-head">
        <div>
          <span class="db-label">Calorías de la semana</span>
          <div class="db-bignum">${dispKcal.toLocaleString('es-ES')}<span class="db-unit">${selIdx === null ? 'kcal media / día' : 'kcal · ' + days[selIdx]}</span></div>
        </div>
        <div class="db-days">${dayLetters.map((l, i) => `<button type="button" class="db-day${i === (selIdx === null ? (new Date().getDay() + 6) % 7 : selIdx) ? ' active' : ''}" onclick="selectWeekDay(${i})" aria-label="${days[i]}">${l}</button>`).join('')}</div>
      </div>
      <div class="db-chart">
        <svg viewBox="0 0 120 48" preserveAspectRatio="none">
          <defs>
            <linearGradient id="dbChartGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="rgba(201,168,76,0.4)"/>
              <stop offset="100%" stop-color="rgba(201,168,76,0)"/>
            </linearGradient>
          </defs>
          <path d="${areaPath}" fill="url(#dbChartGrad)"/>
          <path d="${linePath}" fill="none" stroke="#c9a84c" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
          <line x1="${PAD}" y1="${goalY}" x2="${W - PAD}" y2="${goalY}" stroke="rgba(201,168,76,0.45)" stroke-width="0.7" stroke-dasharray="2 2"/>
          ${selIdx !== null ? `<line x1="${chartPts[selIdx][0].toFixed(1)}" y1="${PAD}" x2="${chartPts[selIdx][0].toFixed(1)}" y2="${H - PAD}" stroke="rgba(240,213,140,0.45)" stroke-width="0.8" stroke-dasharray="2 2"/>` : ''}
          <circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="2.4" fill="#f0d58c"/>
          ${selIdx !== null ? `<circle cx="${chartPts[selIdx][0].toFixed(1)}" cy="${chartPts[selIdx][1].toFixed(1)}" r="2.8" fill="#f0d58c"/>` : ''}
        </svg>
      </div>
    </div>

    <!-- 04 · Entrenamiento de la semana -->
    <div class="db-card">
      <span class="db-label">${ICON('training', 13)} Entrenamiento</span>
      <div class="db-bars">
        ${days.map((d, i) => {
    const on = activeSet.has(i);
    return `
          <div class="db-bar-col">
            <div class="db-bar${on ? ' on' : ''}" style="height:${on ? 68 + (i % 3) * 10 : 16 + (i % 3) * 7}%"></div>
            <span class="db-bar-day">${dayLetters[i]}</span>
          </div>`;
  }).join('')}
      </div>
      <div class="db-foot">${ICON('trophy', 12)} Nivel ${capitalizeFirst(planData?.training_plan?.nivel || '')} · ${reqDays} sesiones/semana</div>
    </div>

    <!-- 05 · Distribución de macros -->
    <div class="db-card">
      <span class="db-label">${ICON('chart', 13)} Distribución</span>
      <div class="db-donut">
        <svg viewBox="0 0 60 60">
          <circle cx="30" cy="30" r="22" stroke="#8a6d23" stroke-dasharray="${(cFrac * 138.2).toFixed(1)} 138.2"/>
          <circle cx="30" cy="30" r="22" stroke="#c9a84c" stroke-dasharray="${(pFrac * 138.2).toFixed(1)} 138.2" stroke-dashoffset="${(-cFrac * 138.2).toFixed(1)}"/>
          <circle cx="30" cy="30" r="22" stroke="#e6c878" stroke-dasharray="${(gFrac * 138.2).toFixed(1)} 138.2" stroke-dashoffset="${(-(cFrac + pFrac) * 138.2).toFixed(1)}"/>
        </svg>
        <div class="db-donut-center">${totalMacroG}<span>g</span></div>
      </div>
      <div class="db-legend">
        <div class="db-legend-row"><span class="db-dot" style="background:#c9a84c"></span> Proteína <b>${protein_g}g · ${pct(protein_g)}%</b></div>
        <div class="db-legend-row"><span class="db-dot" style="background:#8a6d23"></span> Carbohidratos <b>${carbs_g}g · ${pct(carbs_g)}%</b></div>
        <div class="db-legend-row"><span class="db-dot" style="background:#e6c878"></span> Grasas <b>${fat_g}g · ${pct(fat_g)}%</b></div>
      </div>
    </div>

    <!-- 06 · Tu suplementación -->
    <div class="db-card db-sups">
      <span class="db-label">${ICON('supplement', 13)} Suplementación</span>
      ${supsCard}
    </div>

    <!-- 07 · Actualizar a Pro (free) -->
    ${pro ? '' : `<a href="#" onclick="openUpgrade();return false;" class="db-upgrade-card">${ICON('sparkles', 16)} Actualiza a <b>Pro · 14 €/mes</b> para desbloquear todo el plan →</a>`}
  `;
}

// ─── Nutrition Tab: Calendario semanal con opciones ─────────
const CAL_DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const CAL_LETTERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const CAL_MEALS = [
  { key: 'desayuno', label: 'Desayuno', icon: 'sunrise' },
  { key: 'almuerzo', label: 'Almuerzo', icon: 'coffee' },
  { key: 'comida', label: 'Comida', icon: 'utensils' },
  { key: 'merienda', label: 'Merienda', icon: 'apple' },
  { key: 'cena', label: 'Cena', icon: 'moon' },
];

let calMenu = null;      // copia de trabajo del weekly_menu
let calOriginal = null;  // copia pristina (para restaurar)
let calSelectedDay = null;
let calOpenMeal = null;

function renderNutritionTab() {
  // El calendario detallado de comidas es exclusivo de Pro. En free mostramos
  // el bloqueo ("a oscuras": ve kcal del día pero no el detalle de comidas).
  if (!isProUser()) {
    document.getElementById('calWeek').innerHTML = '';
    document.getElementById('calDetail').innerHTML = `
      <div class="db-lock" style="padding:44px 24px;text-align:center;">
        ${ICON('lock', 24)}
        <div style="font-size:18px;font-weight:800;margin:12px 0 4px;">Nutrición detallada solo en Pro</div>
        <div style="font-size:13px;color:var(--text-muted);margin-bottom:16px;">Actualiza a <b>Pro · 14 €/mes</b> para ver y personalizar el menú completo de cada día.</div>
        <a href="#" onclick="openUpgrade();return false;" class="btn-gold">Desbloquear a Pro →</a>
      </div>`;
    return;
  }
  calMenu = JSON.parse(JSON.stringify(planData.weekly_menu || {}));
  calOriginal = JSON.parse(JSON.stringify(calMenu));
  const today = CAL_DAYS[(new Date().getDay() + 6) % 7];
  calSelectedDay = calMenu[today] ? today : (calMenu['Lunes'] ? 'Lunes' : (Object.keys(calMenu)[0] || ''));
  calOpenMeal = null;
  renderCalWeek();
  renderCalDetail();
}

function calDayKcal(day, source) {
  const menu = source ? source[day] : calMenu[day];
  if (!menu) return 0;
  return CAL_MEALS.reduce((sum, m) => sum + (menu[m.key]?.calorias || 0), 0);
}

function calDaySwapped(day) {
  const a = calMenu[day] || {};
  const b = calOriginal[day] || {};
  return CAL_MEALS.some(m => a[m.key]?.nombre !== b[m.key]?.nombre);
}

function calMealSwapped(day, key) {
  return (calMenu?.[day]?.[key]?.nombre || '') !== (calOriginal?.[day]?.[key]?.nombre || '');
}

function renderCalWeek() {
  const el = document.getElementById('calWeek');
  el.innerHTML = CAL_DAYS.map((d, i) => {
    const kcal = calDayKcal(d);
    const swapped = calDaySwapped(d);
    return `
      <button class="cal-day${d === calSelectedDay ? ' active' : ''}${swapped ? ' swapped' : ''}" onclick="selectCalDay('${d}')">
        <span class="cal-day-letter">${CAL_LETTERS[i]}</span>
        <span class="cal-day-name">${d}</span>
        <span class="cal-day-kcal">${kcal ? kcal.toLocaleString('es-ES') + ' kcal' : '—'}</span>
        ${swapped ? '<span class="cal-swap-dot" title="Menú modificado"></span>' : ''}
      </button>`;
  }).join('');
}

function selectCalDay(day) {
  calSelectedDay = day;
  calOpenMeal = null;
  renderCalWeek();
  renderCalDetail();
}

function toggleCalOptions(key) {
  calOpenMeal = calOpenMeal === key ? null : key;
  renderCalDetail();
}

function renderCalDetail() {
  const day = calSelectedDay;
  const menu = calMenu[day];
  const detail = document.getElementById('calDetail');
  if (!menu) {
    detail.innerHTML = '<p style="color:var(--text-muted);padding:24px">No hay menú disponible para este día.</p>';
    return;
  }
  const kcal = calDayKcal(day);
  const origKcal = calDayKcal(day, calOriginal);
  const kcalDiff = kcal - origKcal;
  const swapped = calDaySwapped(day);

  detail.innerHTML = `
    <div class="cal-detail-head">
      <div>
        <div class="cal-detail-day">${day}${swapped ? ' <span class="cal-modified-badge">Modificado</span>' : ''}</div>
        <div class="cal-detail-kcal">${kcal.toLocaleString('es-ES')} kcal${kcalDiff ? ` <span class="cal-diff${kcalDiff > 0 ? ' up' : ' down'}">${kcalDiff > 0 ? '+' : ''}${kcalDiff} kcal</span>` : ''}</div>
        <div class="cal-hint">${ICON('refresh', 12)} Pulsa «Cambiar» en una comida para elegir otra opción de la semana.</div>
      </div>
      ${swapped ? `<button class="cal-restore" onclick="restoreCalDay()">${ICON('rotateLeft', 13)} Restaurar día</button>` : ''}
    </div>
    <div class="cal-meals">
      ${CAL_MEALS.map(m => {
    const meal = menu[m.key];
    if (!meal) return '';
    const open = calOpenMeal === m.key;
    const mealSwapped = calMealSwapped(day, m.key);
    const opts = CAL_DAYS.filter(o => o !== day && calMenu[o]?.[m.key]).map(o => ({ day: o, meal: calMenu[o][m.key] }));
    return `
        <div class="cal-meal${open ? ' open' : ''}${mealSwapped ? ' changed' : ''}">
          <div class="cal-meal-row">
            <span class="cal-meal-icon">${ICON(m.icon, 15)}</span>
            <div class="cal-meal-info">
              <span class="cal-meal-name">${meal.nombre}</span>
              <span class="cal-meal-kcal">${meal.calorias} kcal</span>
              ${Array.isArray(meal.ingredientes) && meal.ingredientes.length ? `<span class="cal-meal-ing">${meal.ingredientes.join(' · ')}</span>` : ''}
            </div>
            <button class="cal-swap-btn" onclick="toggleCalOptions('${m.key}')">${ICON('refresh', 12)} Cambiar</button>
          </div>
          ${open ? `
          <div class="cal-options">
            <div class="cal-options-title">Elige otra opción para el ${m.label.toLowerCase()}:</div>
            <div class="cal-options-grid">
              ${opts.map(o => `
                <button class="cal-opt" onclick="applyCalSwap('${m.key}', '${o.day}')">
                  <span class="cal-opt-name">${o.meal.nombre}</span>
                  <span class="cal-opt-meta">${o.day.slice(0, 3)} · ${o.meal.calorias} kcal</span>
                </button>`).join('')}
              ${mealSwapped ? `
                <button class="cal-opt cal-opt--original" onclick="applyCalSwap('${m.key}', null)">
                  <span class="cal-opt-name">${ICON('rotateLeft', 12)} Volver a la original</span>
                  <span class="cal-opt-meta">${calOriginal[day]?.[m.key]?.nombre || ''}</span>
                </button>` : ''}
            </div>
          </div>` : ''}
        </div>`;
  }).join('')}
    </div>
  `;
}

async function applyCalSwap(mealKey, sourceDay) {
  const day = calSelectedDay;
  if (!calMenu[day]) return;
  const replacement = sourceDay
    ? calMenu[sourceDay]?.[mealKey]
    : calOriginal[day]?.[mealKey];
  if (!replacement) return;

  // Optimista: actualiza la vista al momento
  calMenu[day][mealKey] = JSON.parse(JSON.stringify(replacement));
  calOpenMeal = null;
  renderCalWeek();
  renderCalDetail();

  try {
    const res = await fetch('/api/plan/swap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ day, meal_key: mealKey, replacement })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al guardar');
    if (data.menu) {
      calMenu = data.menu;
      renderCalWeek();
      renderCalDetail();
    }
  } catch (err) {
    alert('No se pudo guardar el cambio: ' + (err.message || 'error de red'));
    renderNutritionTab();
  }
}

async function restoreCalDay() {
  const day = calSelectedDay;
  const changed = CAL_MEALS.filter(m => calMealSwapped(day, m.key)).map(m => m.key);
  for (const key of changed) {
    await applyCalSwap(key, null);
  }
  renderCalWeek();
  renderCalDetail();
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
        <div class="date-badge"><span class="date-label">Entrenas</span><span class="date-val">${equipmentLabel(tp.equipamiento)}</span></div>
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
    <div class="dash-card-label">${ICON('pin', 14)} Notas importantes</div>
    <div style="margin-top:14px;display:flex;flex-direction:column;gap:8px;">
      ${notes.map(n => `<div style="font-size:13px;color:var(--text-muted);padding:10px 14px;background:var(--bg);border-radius:8px;border-left:3px solid var(--gold);">${n}</div>`).join('')}
    </div>
  `;

  const progression = tp.progresion || [];
  if (progression.length) {
    document.getElementById('trainingProgression').innerHTML = `
      <div class="dash-card-label">${ICON('chart', 14)} Progresión semana a semana</div>
      <div style="margin-top:14px;display:flex;flex-direction:column;gap:8px;">
        ${progression.map(n => `<div style="font-size:13px;color:var(--text-muted);padding:10px 14px;background:var(--bg);border-radius:8px;border-left:3px solid #4caf50;">${n}</div>`).join('')}
      </div>
    `;
  } else {
    document.getElementById('trainingProgression').innerHTML = '';
  }
}

function equipmentLabel(eq) {
  return { casa: 'En casa', gimnasio: 'Gimnasio', mixto: 'Mixto' }[eq] || 'Mixto';
}

// ─── Supplements Tab ─────────────────────────────────────────
function renderSupplementsTab() {
  // La suplementación es exclusiva de Pro
  if (!isProUser()) {
    document.getElementById('suppsGrid').innerHTML = `
      <div class="db-lock" style="padding:40px 24px;text-align:center;grid-column:1/-1;">
        ${ICON('lock', 24)}
        <div style="font-size:18px;font-weight:800;margin:12px 0 4px;">Suplementación solo en Pro</div>
        <div style="font-size:13px;color:var(--text-muted);margin-bottom:16px;">Descubre qué suplementos encajan con tu plan actualizando a <b>Pro · 14 €/mes</b>.</div>
        <a href="#" onclick="openUpgrade();return false;" class="btn-gold">Desbloquear a Pro →</a>
      </div>`;
    return;
  }
  const supps = planData?.supplements || [];
  const icons = ['supplement', 'leaf', 'zap', 'flask', 'droplet', 'seedling', 'shield'];
  document.getElementById('suppsGrid').innerHTML = supps.map((s, i) => `
    <div class="supp-card">
      <div class="supp-icon">${ICON(icons[i % icons.length], 19)}</div>
      <div>
        <div class="supp-name">${s.nombre}</div>
        <div class="supp-dosis">${ICON('ruler', 12)} ${s.dosis}</div>
        <div class="supp-motivo">${s.motivo}</div>
      </div>
    </div>
  `).join('');
}

// ─── Subscription Tab ────────────────────────────────────────
function renderSubscriptionTab() {
  const noSubscription = !subData || subData.status === 'none';
  const { status } = subData || {};

  // El usuario no cancela nada: o decide no pagar (plan gratuito, gratis para
  // siempre) o decide pagar (Pro). Sin suscripción y con estado 'cancelled' /
  // 'expired' se muestran todos como el plan gratuito.
  const statusLabels = {
    none: 'Sin suscripción',
    trial: 'Prueba',
    active: 'Activa',
    cancelled: 'Sin pago',
    expired: 'Sin pago',
    past_due: 'Pago pendiente',
  };

  const statusDot = {
    none: '#8a8a8a', trial: '#d9a441', active: '#4caf50', cancelled: '#8a8a8a', expired: '#8a8a8a', past_due: '#e07b39'
  };

  const isFree = noSubscription || status === 'cancelled' || status === 'expired';

  document.getElementById('subDetail').innerHTML = `
    <div class="subscription-head">
      <div>
        <span class="dash-card-label">Estado de suscripción</span>
        <h2 class="subscription-title">${isFree ? 'Plan gratuito' : 'NutroVia Pro'}</h2>
        <p class="subscription-status"><span class="status-dot" style="background:${statusDot[status] || '#8a8a8a'}"></span>${statusLabels[status] || status}</p>
      </div>
      ${!isFree ? `<button class="btn-cancel" onclick="handleCancel()">Dejar de pagar</button>` : ''}
    </div>

    <div class="plan-comparison">
      <div class="plan-option ${isFree ? 'plan-option--current' : ''}">
        <div class="plan-option-top"><span class="plan-name">Free</span>${isFree ? '<span class="plan-current">ACTUAL</span>' : ''}</div>
        <div class="plan-price">0 €<span>/ siempre</span></div>
        <ul class="plan-features">
          <li>Plan personalizado</li>
          <li>Calorías y macros</li>
          <li>Regeneraciones limitadas</li>
          <li class="muted">Menú detallado y suplementos</li>
        </ul>
      </div>
      <div class="plan-option plan-option--pro ${!isFree ? 'plan-option--current' : ''}">
        <div class="plan-option-top"><span class="plan-name">Pro</span><span class="plan-current">14 €/MES</span></div>
        <div class="plan-price">14 €<span>/ mes</span></div>
        <ul class="plan-features">
          <li>Menú semanal detallado</li>
          <li>IA y suplementación</li>
          <li>Check-ins de progreso</li>
          <li>Regeneraciones ilimitadas</li>
        </ul>
        ${isFree ? '<button class="btn-gold" onclick="openUpgrade()">' + (noSubscription ? 'Activar plan' : 'Actualizar a Pro →') + '</button>' : ''}
      </div>
    </div>

    ${noSubscription ? `<div class="dash-card-label" style="margin-top:28px;">No tienes ninguna suscripción activa</div>` : ''}

    ${renderPaymentHistory()}
  `;
}

// ─── Historial de pagos ──────────────────────────────────────
function renderPaymentHistory() {
  if (!paymentHistory.length) return '';

  const statusLabels = { paid: 'Pagado', failed: 'Fallido', pending: 'Pendiente', refunded: 'Reembolsado' };
  const statusIcons = {
    paid: '<span class="status-icon ok">' + (window.NV && NV.icon ? NV.icon('checkCircle', 14) : '') + '</span>',
    failed: '<span class="status-icon err">' + (window.NV && NV.icon ? NV.icon('xCircle', 14) : '') + '</span>',
    pending: '<span class="status-icon warn">' + (window.NV && NV.icon ? NV.icon('clock', 14) : '') + '</span>',
    refunded: '<span class="status-icon neutral">' + (window.NV && NV.icon ? NV.icon('rotateLeft', 14) : '') + '</span>'
  };
  const rows = paymentHistory.map(p => `
    <div style="display:flex;align-items:center;gap:16px;padding:14px 0;border-bottom:1px solid var(--border);flex-wrap:wrap;">
      <div style="flex:1;min-width:140px;">
        <div style="font-size:14px;font-weight:700;">${p.amount_eur} €</div>
        <div style="font-size:12px;color:var(--text-dim);">${p.stripe_invoice_id ? 'Factura ' + p.stripe_invoice_id.slice(0, 8) + '…' : 'Pago'}</div>
      </div>
      <div style="font-size:12px;color:var(--text-muted);min-width:130px;">${p.paid_at ? fmt(p.paid_at) : '—'}</div>
      <span style="font-size:12px;font-weight:600;">${statusIcons[p.status] || ''}${statusLabels[p.status] || p.status}</span>
    </div>
  `).join('');

  return `
    <div style="margin-top:32px;">
      <div class="dash-card-label">Historial de pagos</div>
      <div style="margin-top:12px;">${rows}</div>
    </div>
  `;
}

// ═══ Dejar de pagar ══════════════════════════════════════════
async function handleCancel() {
  if (!confirm('¿Quieres dejar de pagar y volver al plan gratuito?')) return;

  try {
    const res = await fetch('/api/subscription/cancel', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();

    if (!res.ok) {
      alert(data.error || 'Error al dejar de pagar');
      return;
    }

    alert('Has vuelto al plan gratuito. Puedes actualizar a Pro cuando quieras.');
    await loadSubscription();
    renderStatusBanner();
    renderSubscriptionTab();
  } catch (err) {
    alert('Error de conexión');
  }
}

// ═══ Check-in semanal ════════════════════════════════════════
async function checkCheckin() {
  if (!planData) return; // Solo si tiene plan
  try {
    const res = await fetch('/api/checkin/status', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.due) {
      document.getElementById('checkinOverlay').style.display = 'flex';
    }
  } catch (err) {
    console.error('Error comprobando check-in:', err);
  }
}

async function checkinAllGood() {
  try {
    await fetch('/api/checkin/respond', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ response: 'all_good' })
    });
  } catch (err) {
    console.error(err);
  }
  hideCheckinModal();
}

async function checkinWantChange() {
  try {
    await fetch('/api/checkin/respond', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ response: 'want_change' })
    });
  } catch (err) {
    console.error(err);
  }
  window.location.href = 'questionnaire.html?update=1';
}

function hideCheckinModal() {
  document.getElementById('checkinOverlay').style.display = 'none';
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

function showDashboardError(message) {
  const main = document.querySelector('.dashboard-main');
  if (!main) return;
  main.innerHTML = `
    <div style="text-align:center;padding:80px 24px;">
      <h2 style="font-size:24px;font-weight:800;margin-bottom:10px;">No se pudo cargar el panel</h2>
      <p style="color:var(--text-muted);margin-bottom:28px;">${message}</p>
      <button class="btn-gold-large" onclick="window.location.reload()">Reintentar</button>
    </div>
  `;
}

function showNoPlanMessage() {
  const main = document.querySelector('.dashboard-main');
  main.innerHTML = `
    <div style="text-align:center;padding:80px 24px;">
      <div style="font-size:48px;margin-bottom:20px;color:var(--gold);display:flex;justify-content:center;">${ICON('clipboard', 44)}</div>
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

// ═══ Upgrade a Pro (Stripe) ═══════════════════════════════════
let upgradeStripe = null;
let upgradeCardElement = null;
let upgradeSetupSecret = null;
let upgradePendingSubscriptionId = null;
let upgradeInitialized = false;

// Abre el modal de pago para pasar de free a Pro. Si Stripe aún no está
// cargado o el modal no está listo, se inicializa bajo demanda.
function openUpgrade() {
  const overlay = document.getElementById('upgradeOverlay');
  if (!overlay) return;
  overlay.style.display = 'flex';
  initUpgradeCheckout();
}

function closeUpgrade() {
  document.getElementById('upgradeOverlay').style.display = 'none';
}

async function initUpgradeCheckout() {
  if (upgradeInitialized) return;
  if (typeof Stripe === 'undefined') {
    const errEl = document.getElementById('upgradeCardErrors');
    errEl.textContent = 'El sistema de pago seguro no se cargó. Recarga la página e inténtalo de nuevo.';
    errEl.style.display = 'block';
    return;
  }
  try {
    document.getElementById('upgradeSubmitBtn').disabled = true;
    const res = await fetch('/api/subscription/intent', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) {
      const errEl = document.getElementById('upgradeCardErrors');
      errEl.textContent = data.error || 'No se pudo preparar el pago. Inténtalo en unos minutos.';
      errEl.style.display = 'block';
      return;
    }

    upgradeSetupSecret = data.client_secret;
    upgradePendingSubscriptionId = data.subscription_id;
    upgradeStripe = Stripe(data.publishable_key);
    upgradeCardElement = upgradeStripe.elements().create('card', {
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
    upgradeCardElement.mount('#upgradeCardElement');
    upgradeCardElement.on('change', (e) => {
      const errEl = document.getElementById('upgradeCardErrors');
      if (e.error) {
        errEl.textContent = e.error.message;
        errEl.style.display = 'block';
      } else {
        errEl.style.display = 'none';
      }
    });
    upgradeInitialized = true;
    document.getElementById('upgradeSubmitBtn').disabled = false;
  } catch (err) {
    console.error('Error iniciando checkout de upgrade:', err);
    document.getElementById('upgradeSubmitBtn').disabled = false;
  }
}

async function startProUpgrade() {
  const errEl = document.getElementById('upgradeCardErrors');
  const btn = document.getElementById('upgradeSubmitBtn');
  errEl.style.display = 'none';

  if (!upgradeStripe || !upgradeCardElement || !upgradePendingSubscriptionId) {
    errEl.textContent = 'El formulario de pago aún no está listo. Inténtalo de nuevo.';
    errEl.style.display = 'block';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Confirmando tu pago de 14 €...';

  // Confirmar el PaymentIntent de la primera factura (cobra los 14 €). En un
  // reintento ya pagado (client_secret null), saltamos directo a activar.
  if (upgradeSetupSecret) {
    const { error } = await upgradeStripe.confirmCardPayment(upgradeSetupSecret, {
      payment_method: {
        card: upgradeCardElement,
        billing_details: { name: user.name || '', email: user.email || '' },
      },
    });
    if (error) {
      errEl.textContent = error.message;
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Actualizar a Pro · 14 €/mes';
      return;
    }
  }

  btn.textContent = 'Activando tu plan Pro...';
  try {
    const res = await fetch('/api/subscription/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ subscription_id: upgradePendingSubscriptionId }),
    });
    const data = await res.json();

    if (!res.ok) {
      // Reintentar dejar el modal listo para un segundo intento
      errEl.textContent = data.error || 'Error al activar Pro.';
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Actualizar a Pro · 14 €/mes';
      return;
    }

    // Reactivar: recargar para que el backend re-exponga el plan completo
    btn.textContent = '¡Pro activado!';
    window.location.reload();
  } catch (err) {
    console.error('Error en startProUpgrade:', err);
    errEl.textContent = 'Hubo un error de conexión. Inténtalo de nuevo.';
    errEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Actualizar a Pro · 14 €/mes';
  }
}
