require('dotenv').config();

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Path to save the JSON file
const scholarshipsFilePath = path.join(__dirname, 'scholarships_and_grants.json');

const updateScholarshipsJsonFile = async () => {
  try {
    const result = await pool.query('SELECT * FROM academics.scholarships_and_grants');
    const scholarshipsAndGrants = result.rows;

    fs.writeFile(scholarshipsFilePath, JSON.stringify(scholarshipsAndGrants, null, 2), (err) => {
      if (err) {
        console.error('Error writing scholarships file:', err);
      } else {
        console.log('Scholarships and grants file updated successfully!');
      }
    });
  } catch (err) {
    console.error('Error fetching scholarships and grants:', err);
  }
};

updateScholarshipsJsonFile();
