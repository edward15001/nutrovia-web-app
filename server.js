require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initCronJobs } = require('./jobs/cronJobs');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware webhook (debe ir ANTES del JSON parser) ──────
const webhookRouter = require('./routes/webhook');
app.use('/api/webhook', webhookRouter);

// ─── Middleware global ───────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Archivos estáticos (frontend) ──────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ─── Rutas API ───────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/questionnaire', require('./routes/questionnaire'));
app.use('/api/subscription', require('./routes/subscription'));
app.use('/api/plan', require('./routes/plans'));

// ─── Ruta catch-all: sirve index.html para SPA ───────────────
app.get('*', (req, res) => {
    // Solo para rutas que no sean /api
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    } else {
        res.status(404).json({ error: 'Ruta no encontrada' });
    }
});

// ─── Error handler global ──────────────────────────────────
app.use((err, req, res, next) => {
    console.error('❌ Error no capturado:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
});

// ─── Arrancar servidor ───────────────────────────────────────
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`\n🌿 =========================================`);
        console.log(`   NutroVia — Servidor iniciado`);
        console.log(`   http://localhost:${PORT}`);
        console.log(`   Entorno: ${process.env.NODE_ENV || 'development'}`);
        console.log(`🌿 =========================================\n`);

        // Iniciar cron jobs solo en local (en Vercel se pueden configurar via cron)
        initCronJobs();
    });
}

module.exports = app;
