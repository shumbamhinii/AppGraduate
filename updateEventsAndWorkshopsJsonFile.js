require('dotenv').config();

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Path to save the JSON file
const eventsAndworksopsFilePath = path.join(__dirname, 'events_and_workshops.json');

const updateEventsAndWorkshopsJsonFile = async () => {
  try {
    const result = await pool.query('SELECT * FROM academics.events_and_workshops');
    const EventsAndWorkshops = result.rows;

    fs.writeFile(eventsAndworksopsFilePath, JSON.stringify(EventsAndWorkshops, null, 2), (err) => {
      if (err) {
        console.error('Error writing events and workshops file:', err);
      } else {
        console.log('events_and_workshops.json file updated successfully!');
      }
    });
  } catch (err) {
    console.error('Error fetching events and workshops data:', err);
  }
};

updateEventsAndWorkshopsJsonFile();
