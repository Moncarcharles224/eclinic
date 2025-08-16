const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DB_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Initialize database tables
async function initDB() {
  try {
    // Users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        phone VARCHAR(50),
        specialization VARCHAR(255),
        experience INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Appointments table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS appointments (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER REFERENCES users(id),
        doctor_id INTEGER REFERENCES users(id),
        date DATE NOT NULL,
        time VARCHAR(10) NOT NULL,
        symptoms TEXT,
        diagnosis TEXT,
        prescription TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Chat table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chats (
        id SERIAL PRIMARY KEY,
        appointment_id INTEGER REFERENCES appointments(id),
        sender_id INTEGER REFERENCES users(id),
        message TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insert default users if they don't exist
    const adminExists = await pool.query('SELECT id FROM users WHERE email = $1', ['admin@eclinic.com']);
    if (adminExists.rows.length === 0) {
      await pool.query(`
        INSERT INTO users (name, email, password, role) VALUES 
        ('Admin User', 'admin@eclinic.com', '$2a$12$LQv3c1yqBw2uuCD4Gdl30OQ3xvL0Au50cS2Q2b6Ece8aeRXuL.daa', 'admin'),
        ('Dr. Smith', 'doctor@eclinic.com', '$2a$12$LQv3c1yqBw2uuCD4Gdl30OQ3xvL0Au50cS2Q2b6Ece8aeRXuL.daa', 'doctor')
      `);
      
      await pool.query(`
        UPDATE users SET specialization = 'General Medicine', experience = 5 
        WHERE email = 'doctor@eclinic.com'
      `);
    }

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
  }
}

module.exports = { pool, initDB };