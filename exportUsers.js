const fs = require('fs');
const { Pool } = require('pg');
require('dotenv').config();

// Set up PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const exportUsers = async () => {
  try {
    // Query the student data from PostgreSQL
    const result = await pool.query('SELECT registration_number, password FROM academics.students');
    
    // Write the data to users.json
    const filePath = 'users.json';
    fs.writeFileSync(filePath, JSON.stringify(result.rows, null, 2), 'utf-8');
    
    console.log(`Data exported to ${filePath}`);
  } catch (error) {
    console.error('Error exporting data:', error);
  } finally {
    await pool.end();
  }
};

exportUsers();
