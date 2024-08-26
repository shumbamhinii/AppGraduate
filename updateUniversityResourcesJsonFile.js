require('dotenv').config();

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Path to save the JSON file
const universityresourcessFilePath = path.join(__dirname, 'university_resources.json');

const updateUniversityResourcesJsonFile = async () => {
  try {
    const result = await pool.query('SELECT * FROM academics.university_resources');
    const UniversityResources = result.rows;

    fs.writeFile(universityresourcessFilePath, JSON.stringify(UniversityResources, null, 2), (err) => {
      if (err) {
        console.error('Error writing university resources file:', err);
      } else {
        console.log('university_resources.json file updated successfully!');
      }
    });
  } catch (err) {
    console.error('Error fetching university resources data:', err);
  }
};

updateUniversityResourcesJsonFile();