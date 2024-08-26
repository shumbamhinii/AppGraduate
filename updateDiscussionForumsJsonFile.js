require('dotenv').config();

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Path to save the JSON file
const forumsFilePath = path.join(__dirname, 'discussion_forums.json');

const updateDiscussionForumsJsonFile = async () => {
  try {
    const result = await pool.query('SELECT * FROM academics.discussion_forums');
    const discussionForums = result.rows;

    fs.writeFile(forumsFilePath, JSON.stringify(discussionForums, null, 2), (err) => {
      if (err) {
        console.error('Error writing discussion forums file:', err);
      } else {
        console.log('Discussion forums file updated successfully!');
      }
    });
  } catch (err) {
    console.error('Error fetching discussion forums:', err);
  }
};

updateDiscussionForumsJsonFile();
