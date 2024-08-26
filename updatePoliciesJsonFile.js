require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Path to save the JSON file
const policiesFilePath = path.join(__dirname, 'policies.json');

const updatePoliciesJsonFile = async () => {
  try {
    const result = await pool.query('SELECT * FROM academics.policy_details');
    const policies = result.rows;

    fs.writeFile(policiesFilePath, JSON.stringify(policies, null, 2), (err) => {
      if (err) {
        console.error('Error writing policies file:', err);
      } else {
        console.log('Policies file updated successfully!');
      }
    });
  } catch (err) {
    console.error('Error fetching policies:', err);
  }
};

updatePoliciesJsonFile();
