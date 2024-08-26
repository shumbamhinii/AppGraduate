require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Path to save the JSON file
const quotationsFilePath = path.join(__dirname, 'quotations.json');

const updateQuotationsJsonFile = async () => {
  try {
    // Query to fetch data from the program_quotations table
    const result = await pool.query('SELECT * FROM academics.program_quotations');
    const quotations = result.rows;

    fs.writeFile(quotationsFilePath, JSON.stringify(quotations, null, 2), (err) => {
      if (err) {
        console.error('Error writing quotations file:', err);
      } else {
        console.log('Quotations file updated successfully!');
      }
    });
  } catch (err) {
    console.error('Error fetching quotations:', err);
  } finally {
    await pool.end();
  }
};

updateQuotationsJsonFile();
