-- ============================================================
-- NutroVia — Datos semilla (planes nutricionales base)
-- ============================================================

-- Este archivo NO inserta usuarios de prueba en producción.
-- Puedes descomentar la sección de usuario demo para desarrollo local.

-- ─── Usuario demo (solo para desarrollo) ────────────────────
-- Contraseña: NutroVia2024
-- INSERT INTO users (id, name, email, password_hash) VALUES
--   ('00000000-0000-0000-0000-000000000001',
--    'Usuario Demo',
--    'demo@nutrovia.es',
--    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6hsxq7HnV.'); -- NutroVia2024

-- ─── Nota ───────────────────────────────────────────────────
-- Los planes personalizados se generan dinámicamente por el motor
-- planEngine.js en base a las respuestas del cuestionario.
-- No hay plantillas estáticas que insertar; toda la lógica
-- de nutrición y entrenamiento está en el código del servidor.

SELECT 'NutroVia seed completado correctamente' AS status;
