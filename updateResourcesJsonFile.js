require('dotenv').config();

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');


// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Path to save the JSON file
const resourcesFilePath = path.join(__dirname, 'resources.json');

const updateResourcesJsonFile = async () => {
  try {
    const result = await pool.query('SELECT * FROM academics.counselingresources');
    const resources = result.rows;

    fs.writeFile(resourcesFilePath, JSON.stringify(resources, null, 2), (err) => {
      if (err) {
        console.error('Error writing resources file:', err);
      } else {
        console.log('Resources file updated successfully!');
      }
    });
  } catch (err) {
    console.error('Error fetching resources:', err);
  }
};

updateResourcesJsonFile();


