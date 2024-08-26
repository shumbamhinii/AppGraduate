require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Path to save the JSON file
const clubsFilePath = path.join(__dirname, 'clubs_and_societies.json');

const updateClubsJsonFile = async () => {
  try {
    // Query to fetch data from the clubs_and_societies table
    const result = await pool.query('SELECT * FROM academics.clubs_and_societies');
    const clubs = result.rows;

    fs.writeFile(clubsFilePath, JSON.stringify(clubs, null, 2), (err) => {
      if (err) {
        console.error('Error writing clubs file:', err);
      } else {
        console.log('Clubs file updated successfully!');
      }
    });
  } catch (err) {
    console.error('Error fetching clubs:', err);
  } finally {
    await pool.end();
  }
};

updateClubsJsonFile();
