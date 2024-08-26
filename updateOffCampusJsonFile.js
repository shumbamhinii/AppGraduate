require('dotenv').config();

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Path to save the JSON file
const offcampusFilePath = path.join(__dirname, 'offcampus.json');

const updateOffCampusJsonFile = async () => {
  try {
    const result = await pool.query('SELECT * FROM academics.private_accommodation');
    const OffCampus = result.rows;

    fs.writeFile(offcampusFilePath, JSON.stringify( OffCampus, null, 2), (err) => {
      if (err) {
        console.error('Error writing off campus file:', err);
      } else {
        console.log('offcampus.json file updated successfully!');
      }
    });
  } catch (err) {
    console.error('Error fetching off campus data:', err);
  }
};

updateOffCampusJsonFile ();