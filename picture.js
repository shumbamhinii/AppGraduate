require('dotenv').config();
const fs = require('fs');
const { Pool } = require('pg');

// Create a new instance of Pool to connect to your PostgreSQL database
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

// Function to insert an image into the house_images table
const insertImage = async (filePath, houseId) => {
  try {
    // Read the image file into a buffer
    const imageData = fs.readFileSync(filePath);
    
    // Use a parameterized query to prevent SQL injection
    const query = 'INSERT INTO academics.house_images (house_id, picture_data) VALUES ($1, $2)';
    const values = [houseId, imageData];
    
    // Execute the query
    await pool.query(query, values);
    console.log('Image inserted successfully into house_images table!');
  } catch (error) {
    console.error('Error inserting image:', error);
  }
};

// Call the function with the path to your image file and the ID of the house
insertImage("C:\\Users\\Christian\\GraduateApp-backend\\IMG-20240223-WA0005.jpg", 4);
