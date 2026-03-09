const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const db = require('../db/db');
const stripeService = require('../services/stripeService');
const emailService = require('../services/emailService');
const authMiddleware = require('../middleware/auth');

// ─── POST /api/auth/register ─────────────────────────────────
router.post('/register', [
    body('name').trim().notEmpty().withMessage('El nombre es obligatorio'),
    body('email').isEmail().withMessage('Email inválido').normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('La contraseña debe tener mínimo 8 caracteres'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password } = req.body;

    try {
        // Verificar si el email ya existe
        const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'El email ya está registrado' });
        }

        // Hash de la contraseña
        const passwordHash = await bcrypt.hash(password, 12);

        // Crear cliente en Stripe
        const stripeCustomerId = await stripeService.createCustomer(email, name);

        // Insertar usuario en DB
        const userResult = await db.query(
            'INSERT INTO users (name, email, password_hash, stripe_customer_id) VALUES ($1, $2, $3, $4) RETURNING id, name, email, created_at',
            [name, email, passwordHash, stripeCustomerId]
        );
        const user = userResult.rows[0];

        // Generar JWT
        const token = jwt.sign(
            { id: user.id, email: user.email, name: user.name },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            message: 'Usuario registrado correctamente',
            token,
            user: { id: user.id, name: user.name, email: user.email },
        });

    } catch (err) {
        console.error('Error en registro:', err);
        res.status(500).json({ error: 'Error interno del servidor', details: err.message, stack: err.stack });
    }
});

// ─── POST /api/auth/login ────────────────────────────────────
router.post('/login', [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
        const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Credenciales incorrectas' });
        }

        const user = result.rows[0];
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Credenciales incorrectas' });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, name: user.name },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            token,
            user: { id: user.id, name: user.name, email: user.email },
        });

    } catch (err) {
        console.error('Error en login:', err);
        res.status(500).json({ error: 'Error interno del servidor', details: err.message });
    }
});

// ─── GET /api/auth/me ────────────────────────────────────────
router.get('/me', authMiddleware, async (req, res) => {
    try {
        const result = await db.query(
            'SELECT id, name, email, created_at FROM users WHERE id = $1',
            [req.user.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error en /me:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

module.exports = router;
