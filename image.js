require('dotenv').config();
const fs = require('fs');
const { Pool } = require('pg');

// Create a new instance of Pool to connect to your PostgreSQL database
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

// Convert base64 string to binary and insert into database
const insertAnnouncement = async (title, description, base64Image) => {
  try {
    const imageBuffer = Buffer.from(base64Image, 'base64');
    const query = 'INSERT INTO academics.announcements (title, description, imagedata) VALUES ($1, $2, $3)';
    const values = [title, description, imageBuffer];
    await pool.query(query, values);
    console.log('Announcement inserted successfully!');
  } catch (error) {
    console.error('Error inserting announcement:', error);
  }
};

// Example usage
const base64Image = fs.readFileSync("C:\\Users\\Christian\\GraduateApp\\assets\\COREG.png", 'base64');
insertAnnouncement('Announcements', 'Registrartion is to commence on the 23th of August up to the 25th of September', base64Image);
