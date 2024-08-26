require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Path to save the JSON file
const counselingFilePath = path.join(__dirname, 'counseling_services.json');

const updateCounselingJsonFile = async () => {
  try {
    const result = await pool.query('SELECT * FROM academics.counseling_services');
    const counselingServices = result.rows;

    fs.writeFile(counselingFilePath, JSON.stringify(counselingServices, null, 2), (err) => {
      if (err) {
        console.error('Error writing counseling services file:', err);
      } else {
        console.log('Counseling services file updated successfully!');
      }
    });
  } catch (err) {
    console.error('Error fetching counseling services:', err);
  } finally {
    await pool.end();
  }
};

updateCounselingJsonFile();
