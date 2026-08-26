/**
 * NutroVia — Migraciones ligeras (idempotentes)
 * Se ejecutan al arrancar el servidor para que bases de datos existentes
 * reciban las nuevas columnas sin necesidad de recrear el schema.
 */
const db = require('./db');

const MIGRATIONS = [
  // Última vez que el usuario registró/actualizó sus valores
  `ALTER TABLE questionnaire_answers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`,

  // Último check-in de progreso respondido por el usuario (in-app)
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_checkin_at TIMESTAMPTZ`,

  // Último email de check-in semanal enviado (para no duplicar avisos)
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_checkin_email_at TIMESTAMPTZ`,

  // Equipamiento disponible para el entrenamiento (casa / gimnasio / mixto)
  `ALTER TABLE questionnaire_answers ADD COLUMN IF NOT EXISTS training_equipment VARCHAR(20) DEFAULT 'mixto'`,

  // Notas dietéticas y consejos generales del plan (se muestran en el dashboard)
  `ALTER TABLE nutrition_plans ADD COLUMN IF NOT EXISTS notas_dieta JSONB NOT NULL DEFAULT '[]'`,
  `ALTER TABLE nutrition_plans ADD COLUMN IF NOT EXISTS consejos_generales JSONB NOT NULL DEFAULT '[]'`,

  // Sólo un registro de cuestionario y un plan por usuario (para el upsert ON CONFLICT).
  // PostgreSQL no soporta ADD CONSTRAINT IF NOT EXISTS, así que comprobamos pg_constraint.
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'questionnaire_answers_user_id_key') THEN
       ALTER TABLE questionnaire_answers ADD CONSTRAINT questionnaire_answers_user_id_key UNIQUE (user_id);
     END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'nutrition_plans_user_id_key') THEN
       ALTER TABLE nutrition_plans ADD CONSTRAINT nutrition_plans_user_id_key UNIQUE (user_id);
     END IF;
   END $$`,
];

async function runMigrations() {
  for (const sql of MIGRATIONS) {
    try {
      await db.query(sql);
    } catch (err) {
      // Si la tabla aún no existe (BD recién creada sin schema.sql), se ignora:
      // schema.sql ya incluye estas columnas.
      if (err.code === '42P01' || err.code === '3F000') {
        console.warn('⚠️  Migración omitida (tabla aún no creada):', err.message);
      } else {
        console.error('❌ Error en migración:', err.message);
      }
    }
  }
  console.log('✅ Migraciones de BD aplicadas');
}

module.exports = { runMigrations };
