require('dotenv').config();
const { Client } = require('pg');

async function setupDatabase() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'pass@123',
    port: process.env.DB_PORT || 5432,
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL successfully!');

    // 1. Create the database if it doesn't exist
    const dbCheck = await client.query("SELECT 1 FROM pg_database WHERE datname = 'doctor_appointment_db'");
    if (dbCheck.rowCount === 0) {
      await client.query('CREATE DATABASE doctor_appointment_db');
      console.log('Database "doctor_appointment_db" created successfully!');
    } else {
      console.log('Database "doctor_appointment_db" already exists.');
    }

    // 2. Set the password for postgres user to pass@123
    await client.query("ALTER USER postgres WITH PASSWORD 'pass@123'");
    console.log('Password for user "postgres" successfully updated');

  } catch (err) {
    console.error('Error during setup:', err);
  } finally {
    await client.end();
  }
}

setupDatabase();