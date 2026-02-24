const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('❌ Error inesperado en cliente PostgreSQL:', err);
});

pool.on('connect', () => {
  if (process.env.NODE_ENV !== 'test') {
    console.log('✅ Conexión a PostgreSQL establecida');
  }
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
