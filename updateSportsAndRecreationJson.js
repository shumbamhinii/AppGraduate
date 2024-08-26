require('dotenv').config();

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Path to save the JSON file
const sportsAndRecreationFilePath = path.join(__dirname, 'sports_and_recreation.json');

const updateSportsAndRecreationJsonFile = async () => {
  try {
    const result = await pool.query('SELECT * FROM academics.sports_and_recreation');
    const sportsAndRecreation = result.rows;

    fs.writeFile(sportsAndRecreationFilePath, JSON.stringify(sportsAndRecreation, null, 2), (err) => {
      if (err) {
        console.error('Error writing sports and recreation file:', err);
      } else {
        console.log('sports_and_recreation.json file updated successfully!');
      }
    });
  } catch (err) {
    console.error('Error fetching sports and recreation data:', err);
  }
};

updateSportsAndRecreationJsonFile();
