require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Path to save the JSON file
const counselorsFilePath = path.join(__dirname, 'counselors.json');

const updateCounselorsJsonFile = async () => {
  try {
    const result = await pool.query('SELECT * FROM academics.counselors');
    const counselors = result.rows;

    fs.writeFile(counselorsFilePath, JSON.stringify(counselors, null, 2), (err) => {
      if (err) {
        console.error('Error writing counselors file:', err);
      } else {
        console.log('Counselors file updated successfully!');
      }
    });
  } catch (err) {
    console.error('Error fetching counselors:', err);
  } finally {
    await pool.end();
  }
};

// Execute the function to update the JSON file
updateCounselorsJsonFile();
