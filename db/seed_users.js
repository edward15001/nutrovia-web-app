require('dotenv').config();
const fs = require('fs');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    const csv = fs.readFileSync('db/users_seed.csv', 'utf8').trim().split('\n');
    let inserted = 0;
    
    // Skip header (i=0)
    for (let i = 1; i < csv.length; i++) {
      const line = csv[i].split(',');
      if (line.length < 5) continue;
      
      const [id, name, email, password_hash, stripe_id, created_at, updated_at] = line;
      
      await pool.query(`
        INSERT INTO users (id, name, email, password_hash, stripe_customer_id, created_at, updated_at) 
        VALUES ($1, $2, $3, $4, NULLIF($5, ''), $6, $7)
        ON CONFLICT (email) DO NOTHING
      `, [id, name, email, password_hash, stripe_id || '', created_at, updated_at]);
      
      inserted++;
    }
    
    console.log(`✅ Success: Inserted ${inserted} users from CSV into Supabase`);
  } catch (err) {
    console.error('❌ Error inserting users:', err.message);
  } finally {
    await pool.end();
  }
}

main();
