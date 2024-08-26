require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Path to save the JSON file
const coursesFilePath = path.join(__dirname, 'courses.json');

const fetchCourses = async () => {
  try {
    const result = await pool.query('SELECT * FROM academics.courses');
    const courses = result.rows;

    fs.writeFile(coursesFilePath, JSON.stringify(courses, null, 2), (err) => {
      if (err) {
        console.error('Error writing courses file:', err);
      } else {
        console.log('Courses file created successfully!');
      }
    });
  } catch (err) {
    console.error('Error fetching courses:', err);
  } finally {
    await pool.end();
  }
};

fetchCourses();
