// ─── Vytal — icons.js ────────────────────────────────────
// Librería de iconos SVG planos (stroke, 24×24, currentColor).
// Sustituyen a los emojis en toda la web. El color se hereda
// con `currentColor` → usar dentro de elementos con color corporativo.
//
// Uso en HTML:   <span class="x" data-icon="leaf"></span>
// Uso en JS:     NV.icon('leaf', 18)

window.NV = window.NV || {};

// Los paths con prefijo "f:" se rellenan (fill), el resto se dibujan con stroke.
NV.icons = {
  // ── UI base ─────────────────────────────────────────────
  menu: ['M4 7h16', 'M4 12h16', 'M4 17h16'],
  sun: [
    'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
    'M12 2v2', 'M12 20v2', 'M4.9 4.9l1.4 1.4', 'M17.7 17.7l1.4 1.4',
    'M2 12h2', 'M20 12h2', 'M4.9 19.1l1.4-1.4', 'M17.7 6.3l1.4-1.4'
  ],
  moon: ['M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z'],
  check: ['M5 12.5l4.5 4.5L19 7'],
  checkCircle: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M8.5 12l2.5 2.5 4.5-5'],
  info: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 11v5', 'M12 8h.01'],
  xCircle: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M9.5 9.5l5 5', 'M14.5 9.5l-5 5'],
  clock: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 7v5l3 2'],
  refresh: ['M21 12a9 9 0 1 1-2.6-6.3', 'M21 3v5h-5'],
  rotateLeft: ['M3 12a9 9 0 1 0 2.6-6.3', 'M3 4v5h5'],
  gift: [
    'M3.5 11h17v9a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 20v-9z',
    'M2.5 7.5h19V11h-19z',
    'M12 11v10.5',
    'M12 7.5C12 5 10.5 3.5 8.8 3.5 7.4 3.5 6.5 4.5 6.5 6c0 1 1 1.5 2 1.5H12z',
    'M12 7.5c0-2.5 1.5-4 3.2-4C16.6 3.5 17.5 4.5 17.5 6c0 1-1 1.5-2 1.5H12z'
  ],
  lock: ['M5.5 11h13v9.5h-13z', 'M8 11V7.5a4 4 0 0 1 8 0V11'],
  sparkles: [
    'f:M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z',
    'f:M19 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2z'
  ],
  lightbulb: [
    'M12 3a6 6 0 0 1 4 10.5c-.8.7-1 1.4-1 2.5H9c0-1.1-.2-1.8-1-2.5A6 6 0 0 1 12 3z',
    'M9.5 18.5h5', 'M10.5 21h3'
  ],

  // ── Marca / navegación ──────────────────────────────────
  home: ['M3 10.5L12 3l9 7.5', 'M5.5 9.5V21h13V9.5', 'M9.5 21v-6h5v6'],
  nutrition: ['M6 19C6 10 11 4.5 20 4.5c0 9-5.5 14.5-14 14.5z', 'M6 19c4.5-4.5 8-8 11-11'],
  training: ['M6.5 6.5v11', 'M17.5 6.5v11', 'M3 9v6', 'M21 9v6', 'M6.5 12h11'],
  supplement: [
    'M10.5 3.5h3a3 3 0 0 1 3 3v11a3 3 0 0 1-3 3h-3a3 3 0 0 1-3-3v-11a3 3 0 0 1 3-3z',
    'M7.5 12h9'
  ],
  subscription: ['M3.5 6.5h17a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-17a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z', 'M2.5 10.5h19', 'M5.5 15h4'],
  pencil: ['M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19l-4 1z', 'M14 6l4 4'],
  target: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9z', 'f:M12 13.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z'],
  chart: ['M4 20V11', 'M10 20V5', 'M16 20v-7', 'M3 20.5h18'],
  zap: ['f:M13 2L4 14h6l-1 8 9-12h-6l1-8z'],

  // ── Metabolismo / macros ────────────────────────────────
  flame: ['f:M12 2c1.6 3.6.6 5.8 2 8.4 1 1.9 3.2 2.9 3.2 5.6a5.2 5.2 0 0 1-10.4 0c0-2.6 1.6-4.2 3.2-5.8.5 1 1 1.8 2.1 2.1-.5-3.4-.4-6.7-.1-10.3z'],
  scale: [
    'M12 3.5v17', 'M5 20.5h14',
    'M4.5 6.5h15',
    'M7 6.5l-2.8 4.6a3 3 0 0 0 5.6 0L7 6.5z',
    'M17 6.5l-2.8 4.6a3 3 0 0 0 5.6 0L17 6.5z'
  ],
  heart: ['M12 20.5S4 15.8 4 10.6C4 7.9 6 5.8 8.4 5.8c1.5 0 2.8.8 3.6 2 .8-1.2 2.1-2 3.6-2C17.9 5.8 20 7.9 20 10.6c0 5.2-8 9.9-8 9.9z'],
  pulse: ['M2.5 12h4.5l2-6.5 4 13 2.5-6.5h6'],
  droplet: ['M12 3s6.5 6.2 6.5 10.5a6.5 6.5 0 0 1-13 0C5.5 9.2 12 3 12 3z'],
  egg: ['M12 4.5c2.7 0 5 2.9 5 6.3s-2.3 7.2-5 7.2-5-3.8-5-7.2 2.3-6.3 5-6.3z'],
  wheat: [
    'M12 21V5',
    'M7 5.5l5 2.5 5-2.5', 'M7 10l5 2.5 5-2.5', 'M7 14.5l5 2.5 5-2.5'
  ],
  carrot: [
    'M12 21c-4.5-3-6.5-7-5.5-11 3.5-.5 6.5-2 8.5-4.5 2 2.5 3 5.5 2.5 9-1.5 2.5-3 5-5.5 6.5z',
    'M13 13.5c1.5-1.5 2.5-3.5 3-5.5',
    'M12 4c0-1 1-2 2-2'
  ],
  leaf: ['M5 19C5 10 10 4.5 20 4.5c0 10-6 14.5-15 14.5z', 'M5 19c4-4 8-7.5 11.5-10.5'],
  seedling: ['M12 21V9', 'M12 9C12 6.5 10 5 7.5 5 7.5 7.5 9.5 9 12 9z', 'M12 9c0-2.5 2-4 4.5-4 0 2.5-2 4-4.5 4z'],
  trophy: [
    'M8 4h8v5.5a4 4 0 0 1-8 0V4z',
    'M8 6H5.5a2 2 0 0 0 2 3.5H8',
    'M16 6h2.5a2 2 0 0 1-2 3.5H16',
    'M12 13.5V17',
    'M9 20.5h6', 'M7.5 17h9'
  ],
  armchair: [
    'M5.5 11V6.5a3 3 0 0 1 3-3h7a3 3 0 0 1 3 3V11',
    'M3.5 11h17v4.5a3 3 0 0 1-3 3h-11a3 3 0 0 1-3-3V11z',
    'M6 18.5V21', 'M18 18.5V21'
  ],
  walk: [
    'M12 4.5a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6z',
    'M11.5 8l-1.6 4.5 2 1 1.6 4.5',
    'M10.2 9.5l-3.2 1.8 1.4 1.8',
    'M13 13.5l3 .5 1 2.5'
  ],
  run: [
    'M13.5 4a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6z',
    'M12.5 7.5l-1 4 2.5 1.5 2 5',
    'M12 11.5l-2.5 3-2.5-1.5 1-2.5',
    'M15.5 12.5l2.5-2-1.5-1.5'
  ],
  play: ['M8 5.5v13l11-6.5z'],

  // ── Comidas ─────────────────────────────────────────────
  sunrise: [
    'M12 2.5v2', 'M4.9 5.1l1.4 1.4', 'M19.1 5.1l-1.4 1.4',
    'M2.5 12h2', 'M19.5 12h2',
    'M5 17.5a7 7 0 0 1 14 0', 'M3 21h18'
  ],
  coffee: ['M6 8.5h11v5.5a4 4 0 0 1-4 4h-3a4 4 0 0 1-4-4V8.5z', 'M17 9.5h1.5a2.5 2.5 0 0 1 0 5H17', 'M9 5.5V3.5', 'M12 5.5V3.5', 'M6 18.5h9'],
  utensils: [
    'M6.5 3v6', 'M9.5 3v6', 'M8 9.5V21',
    'M15.5 3c-.8 3-1 5.5-1 8.5L15 21h2.5l.5-9.5c0-3-.5-5.5-2.5-8.5z'
  ],
  apple: [
    'M12 7.5C8 7.5 5.5 9.8 5.5 13.2c0 3.6 2.5 6.3 6.5 6.3s6.5-2.7 6.5-6.3C18.5 9.8 16 7.5 12 7.5z',
    'M12 7.5c0-1.7.8-2.9 2-4',
    'M14 3.5c1.8-.3 2.8.4 3 1.8-1.6.4-2.6-.2-3-1.8z'
  ],
  milk: [
    'M8 3.5h8l-1.5 3.8v11a3 3 0 0 1-3 3h-1a3 3 0 0 1-3-3V7.3L8 3.5z',
    'M8.5 3.5l1.5 3.8h4l1.5-3.8',
    'M10 14.5a2 2 0 0 1 4 0'
  ],
  butterfly: [
    'M12 5v14',
    'M12 11c-3-3.5-7-3.5-8.5-1.5-1 1.5.5 5.5 8.5 5v-3.5z',
    'M12 11c3-3.5 7-3.5 8.5-1.5 1 1.5-.5 5.5-8.5 5v-3.5z',
    'M11.5 5c-.6-1.6-1.8-2-2.5-1.5', 'M12.5 5c.6-1.6 1.8-2 2.5-1.5'
  ],

  // ── Salud / extras ──────────────────────────────────────
  calendar: ['M4 5.5h16V20H4z', 'M4 9.5h16', 'M8 3.5v4', 'M16 3.5v4'],
  ruler: ['M3.5 15L15 3.5l5.5 5.5L9 20.5l-5.5-5.5z', 'M9 9l2 2', 'M12 6l2 2', 'M6 12l2 2'],
  flask: [
    'M10 3h4', 'M10.5 3v6.5L5.5 19a2 2 0 0 0 1.8 3h9.4a2 2 0 0 0 1.8-3l-5-9.5V3',
    'M7.5 15.5h9'
  ],
  shield: ['M12 3l7 3v5.5c0 4.6-3 8.2-7 9.5-4-1.3-7-4.9-7-9.5V6l7-3z'],
  pin: ['M12 21s-7-5.4-7-11a7 7 0 0 1 14 0c0 5.6-7 11-7 11z', 'f:M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z'],
  warning: ['M12 3.5L21.5 20h-19L12 3.5z', 'M12 9.5v4.5', 'M12 16.9h.01'],
  clipboard: ['M8.5 4h7a1 1 0 0 1 1 1v1.5h-9V5a1 1 0 0 1 1-1z', 'M6 6.5h12V20H6z', 'M9 11h6', 'M9 14.5h6'],
  trendUp: ['M3 17l6-6 4 4 8-8', 'M15 7h6v6'],
  male: [
    'M8.5 20.5a5.2 5.2 0 1 0 0-10.4 5.2 5.2 0 0 0 0 10.4z',
    'M12.6 11.6L20 4.2',
    'M20 4.2v5.3', 'M20 4.2h-5.3'
  ],
  female: [
    'M12 12.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9z',
    'M12 12.5V21',
    'M9 18h6'
  ]
};

/**
 * Devuelve el SVG de un icono.
 * @param {string} name   Nombre del icono
 * @param {number} size   Tamaño en px (por defecto 18)
 * @param {number} stroke Grosor de trazo (por defecto 1.8)
 */
NV.icon = function (name, size, stroke) {
  const paths = NV.icons[name] || [];
  const s = size || 18;
  const sw = stroke || 1.8;
  const body = paths.map(function (p) {
    if (p.indexOf('f:') === 0) {
      return '<path d="' + p.slice(2) + '" fill="currentColor" stroke="none"/>';
    }
    return '<path d="' + p + '"/>';
  }).join('');
  return '<svg viewBox="0 0 24 24" width="' + s + '" height="' + s + '" fill="none" stroke="currentColor" stroke-width="' + sw +
    '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + '</svg>';
};

// Inyecta iconos en elementos con data-icon="nombre" (+ data-icon-size)
document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('[data-icon]').forEach(function (el) {
    const name = el.getAttribute('data-icon');
    const size = parseInt(el.getAttribute('data-icon-size') || '18', 10);
    el.innerHTML = NV.icon(name, size);
  });
});
