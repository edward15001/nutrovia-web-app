// ─── NutroVia — theme.js ───────────────────────────────────
// Modo claro / oscuro con persistencia en localStorage.
// - Respeta la preferencia del sistema la primera vez.
// - Aplica `data-theme` en <html> (los estilos viven en styles.css).
// - Gestiona los botones [data-theme-toggle] (icono sol/luna).

(function () {
  const KEY = 'nv-theme';

  function prefersLight() {
    try {
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
    } catch (e) { return false; }
  }

  function current() {
    try {
      const stored = localStorage.getItem(KEY);
      if (stored === 'light' || stored === 'dark') return stored;
    } catch (e) { /* ignore */ }
    return prefersLight() ? 'light' : 'dark';
  }

  function syncToggleButtons(theme) {
    document.querySelectorAll('[data-theme-toggle]').forEach(function (btn) {
      const icon = btn.querySelector('[data-theme-icon]');
      const isDark = theme === 'dark';
      if (icon && window.NV && NV.icon) {
        icon.innerHTML = NV.icon(isDark ? 'moon' : 'sun', 16);
      }
      btn.setAttribute('aria-label', isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
      btn.setAttribute('aria-pressed', String(!isDark));
    });
  }

  function apply(theme, persist) {
    document.documentElement.setAttribute('data-theme', theme);
    if (persist) {
      try { localStorage.setItem(KEY, theme); } catch (e) { /* ignore */ }
    }
    syncToggleButtons(theme);
  }

  function toggle() {
    apply(current() === 'dark' ? 'light' : 'dark', true);
  }

  // Aplicar al cargar (sin persistir si el usuario aún no eligió)
  apply(current(), false);

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-theme-toggle]').forEach(function (btn) {
      btn.addEventListener('click', toggle);
    });
    syncToggleButtons(current());
  });
})();
