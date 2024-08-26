require('dotenv').config();

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Path to save the JSON file
const alumniFilePath = path.join(__dirname, 'alumni.json');

const updateAlumniJsonFile = async () => {
  try {
    const result = await pool.query('SELECT * FROM academics.alumni');
    const alumni = result.rows;

    fs.writeFile(alumniFilePath, JSON.stringify(alumni, null, 2), (err) => {
      if (err) {
        console.error('Error writing alumni file:', err);
      } else {
        console.log('Alumni file updated successfully!');
      }
    });
  } catch (err) {
    console.error('Error fetching alumni:', err);
  }
};

updateAlumniJsonFile();
