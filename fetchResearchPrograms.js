require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Path to save the JSON file
const researchProgramsFilePath = path.join(__dirname, 'research_programs.json');

const fetchResearchPrograms = async () => {
  try {
    const result = await pool.query('SELECT * FROM academics.research_programs');
    const programs = result.rows;

    fs.writeFile(researchProgramsFilePath, JSON.stringify(programs, null, 2), (err) => {
      if (err) {
        console.error('Error writing research programs file:', err);
      } else {
        console.log('Research programs file created successfully!');
      }
    });
  } catch (err) {
    console.error('Error fetching research programs:', err);
  } finally {
    await pool.end();
  }
};

fetchResearchPrograms();
