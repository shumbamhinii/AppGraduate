require('dotenv').config();

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');


// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Path to save the JSON file
const opportunitiesFilePath = path.join(__dirname, 'opportunities.json');

const updateOpportunitiesJsonFile = async () => {
  try {
    const result = await pool.query('SELECT * FROM academics.opportunities');
    const opportunities = result.rows;

    fs.writeFile(opportunitiesFilePath, JSON.stringify(opportunities, null, 2), (err) => {
      if (err) {
        console.error('Error writing opportunities file:', err);
      } else {
        console.log('opportunities file updated successfully!');
      }
    });
  } catch (err) {
    console.error('Error fetching opportunities:', err);
  }
};

updateOpportunitiesJsonFile();
