require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { Pool } = require('pg');
const axios = require('axios');
const cron = require('node-cron');
const session = require('express-session');
const db = require('./db');
const http = require('http');
const socketIo = require('socket.io');
const getBotResponse = require('./chatbotService');
const pgSession = require('connect-pg-simple')(session);
const WebSocket = require('ws');


const pool = new Pool({
  connectionString: 'postgres://localhost:NCRVidDgzsWqpQZA7Z49RR3zFGAWcJtq@dpg-cr69udbqf0us73a26bb0-a.oregon-postgres.render.com:5432/uo_z', // Use the environment variable for connection
  ssl: {
    rejectUnauthorized: true // Set to true if your server has a valid SSL certificate
  }
});

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json()); // For parsing application/json
app.use(cors({
  origin: '*', // Adjust this to be more restrictive if needed
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
})); // Enable CORS
app.use(session({
  store: new pgSession({
    pool: pool,
    tableName: 'session',
    schemaName: 'academics'
  }),
  secret: process.env.SESSION_SECRET || 'your_secret_key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true if using HTTPS
    maxAge: null
  }
}));
// Middleware to check session
function isAuthenticated(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    res.status(401).json({ message: 'Unauthorized' });
  }
}
const clients = new Map(); // Map to track clients by user phone number

wss.on('connection', (ws, request) => {
  console.log('Client connected');
  let sessionId = null;

  // Extract session ID from cookies
  const cookies = request.headers.cookie || '';
  const sessionCookie = cookies.split(';').find(cookie => cookie.trim().startsWith('connect.sid='));
  if (sessionCookie) {
    sessionId = decodeURIComponent(sessionCookie.split('=')[1]);
    console.log('Session ID extracted:', sessionId);
  } else {
    console.error('No session ID found in cookies');
    ws.close(4000, 'Authentication error');
    return;
  }

  if (sessionId) {
    // Query the database to get session data based on the session ID
    pool.query('SELECT sess FROM academics.session WHERE sid = $1', [sessionId])
      .then(result => {
        if (result.rows.length > 0) {
          const sessionData = JSON.parse(result.rows[0].sess); // Parse session data
          ws.session = sessionData; // Attach session data to WebSocket
          console.log('Session data attached to WebSocket:', ws.session);

          // Track this client by their phone number
          const userPhoneNumber = ws.session.user.phone_number;
          clients.set(userPhoneNumber, ws);

          ws.on('message', async (message) => {
            console.log('Received:', message);
            try {
              const { receiver, text } = JSON.parse(message);

              // Save message to the database
              await pool.query(
                'INSERT INTO academics.messages (sender_phone_number, receiver_phone_number, message) VALUES ($1, $2, $3)',
                [userPhoneNumber, receiver, text]
              );

              // Send message only to the receiver if they're connected
              const receiverClient = clients.get(receiver);
              if (receiverClient && receiverClient.readyState === WebSocket.OPEN) {
                receiverClient.send(JSON.stringify({ sender: userPhoneNumber, receiver, text }));
              }
            } catch (error) {
              console.error('Error handling message:', error);
            }
          });

        } else {
          console.error('Session not found for ID:', sessionId);
          ws.close(4000, 'Authentication error');
        }
      })
      .catch(err => {
        console.error('Session query error:', err);
        ws.close(4000, 'Authentication error');
      });
  } else {
    ws.close(4000, 'Authentication error');
  }

  ws.on('close', () => {
    console.log('Client disconnected');
    // Remove client from the map when they disconnect
    if (ws.session && ws.session.user && ws.session.user.phone_number) {
      clients.delete(ws.session.user.phone_number);
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});



// Login route
app.post('/login', async (req, res) => {
  const { registration_number, password } = req.body;
  const trimmedRegistrationNumber = registration_number.trim();

  try {
    const result = await pool.query(
      'SELECT * FROM academics.students WHERE registration_number = $1',
      [trimmedRegistrationNumber]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'User not found' });
    }

    const user = result.rows[0];
    const passwordMatch = password === user.password; // Adjust if passwords are hashed

    if (passwordMatch) {
      req.session.user = { 
        id: user.registration_number, 
        name: user.name,
        phone_number: user.phone_number // Include phone number in session
      };
      console.log('Session data after login:', req.session); // Log session data for debugging
      req.session.save(err => {
        if (err) {
          console.error('Error saving session:', err);
          return res.status(500).json({ message: 'Server error' });
        }
        res.status(200).json({ message: 'Login successful' });
      });
    } else {
      res.status(400).json({ message: 'Invalid credentials' });
    }
  } catch (err) {
    console.error('Error during login:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Endpoint to get user phone number
app.get('/api/getUserPhoneNumber', isAuthenticated, (req, res) => {
  const phoneNumber = req.session.user?.phone_number;
  if (phoneNumber) {
    res.json({ phoneNumber });
  } else {
    res.status(404).json({ message: 'Phone number not found' });
  }
})
app.post('/chat', async (req, res) => {
  const { message } = req.body;
  const session = req.session;

  try {
    const botResponse = await getBotResponse(message, session);
    res.status(200).json({ text: botResponse });
  } catch (error) {
    res.status(500).send('Error processing chatbot request');
  }
});

const filePaths = {
  research: path.join(__dirname, 'research_programs.json'),
  counseling: path.join(__dirname, 'counseling_services.json'),
  resources: path.join(__dirname, 'resources.json'),
  courses: path.join(__dirname, 'courses.json'),
  registrations: path.join(__dirname, 'registrations.json'),
  counselors: path.join(__dirname, 'counselors.json'),
  opportunities: path.join(__dirname, 'opportunities.json'),
  scholarships: path.join(__dirname, 'scholarships_and_grants.json'),
  policies: path.join(__dirname, 'policies.json'),
  quotations: path.join(__dirname, 'quotations.json'),
  clubs_and_societies: path.join(__dirname, 'clubs_and_societies.json'),
  sports_and_recreation: path.join(__dirname, 'sports_and_recreation.json'),
  university_resources: path.join(__dirname, 'university_resources.json'),
  offcampus: path.join(__dirname, 'offcampus.json'),
  discussion_forums: path.join(__dirname, 'discussion_forums.json'),
  alumni: path.join(__dirname, 'alumni.json'),
  events_and_workshops: path.join(__dirname, 'events_and_workshops.json')
};
// Endpoint to retrieve courses from JSON file
app.get('/courses', async (req, res) => {
  try {
    // Query the database for courses
    const result = await pool.query('SELECT * FROM academics.courses');
    
    // Send the results as JSON
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching courses:', err);
    res.status(500).send('Server error');
  }
});
app.get('/courses/:code', async (req, res) => {
  const courseCode = req.params.code;

  try {
    // Query the database for the course by code
    const result = await pool.query('SELECT * FROM academics.courses WHERE code = $1', [courseCode]);

    if (result.rows.length > 0) {
      // Send the course data, including the image URL, as JSON
      res.json(result.rows[0]);
    } else {
      res.status(404).send('Course not found');
    }
  } catch (err) {
    console.error('Error fetching course:', err);
    res.status(500).send('Server error');
  }
});


// Remember God and Fight for whats Yours

app.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Error destroying session:', err);
      return res.status(500).send('Server error');
    }
    res.status(200).send('Logged out successfully');
  });
});


app.post('/register-courses', isAuthenticated, async (req, res) => {
  const { courses } = req.body;

  // Ensure courses is an array
  if (!courses || !Array.isArray(courses)) {
    return res.status(400).send('Invalid request data');
  }

  // Check if the user is authenticated and has a valid session
  const registration_number = req.session?.user?.id;
  if (!registration_number) {
    return res.status(401).send('User not authenticated');
  }

  const registrationData = {
    registration_number: registration_number.trim(),
    courses: courses.map(code => code.trim())
  };

  if (!registrationData.registration_number || registrationData.courses.length === 0) {
    console.error('Invalid registration data:', registrationData);
    return res.status(400).send('Invalid registration data');
  }

  try {
    await pool.query('BEGIN');

    for (const courseCode of courses) {
      // Check if the course is already registered
      const { rowCount: existingCount } = await pool.query(
        'SELECT 1 FROM academics.course_registrations WHERE registration_number = $1 AND course_code = $2',
        [registration_number.trim(), courseCode.trim()]
      );

      if (existingCount === 0) {
        console.log(`Registering course ${courseCode} for student ${registration_number}`);

        // Insert into course_registrations table
        const registrationResult = await pool.query(
          'INSERT INTO academics.course_registrations (registration_number, course_code) VALUES ($1, $2) RETURNING *',
          [registration_number.trim(), courseCode.trim()]
        );
        console.log('Inserted registration:', registrationResult.rows[0]);

        // Insert into student_results table
        const resultResult = await pool.query(
          'INSERT INTO academics.student_results (registration_number, course_code, result, created_at) VALUES ($1, $2, NULL, NOW()) RETURNING *',
          [registration_number.trim(), courseCode.trim()]
        );
        console.log('Inserted result:', resultResult.rows[0]);

        // Insert into student_assessments table
        const assessmentResult = await pool.query(
          `INSERT INTO academics.student_assessments
            (student_id, course_code, assessment_1, assessment_2, assessment_3, assessment_4, assessment_5, created_at)
            VALUES ($1, $2, NULL, NULL, NULL, NULL, NULL, NOW()) RETURNING *`,
          [registration_number.trim(), courseCode.trim()]
        );
        console.log('Inserted assessment:', assessmentResult.rows[0]);

      } else {
        console.log(`Course ${courseCode} is already registered for student ${registration_number}`);
      }
    }

    await pool.query('COMMIT');
    res.status(200).send('Courses registered successfully and records created in results and assessments tables');
  } catch (err) {
    console.error('Error during course registration transaction:', err);
    await pool.query('ROLLBACK');
    res.status(500).send('Server error');
  }
});




app.get('/registered-courses', async (req, res) => {
  try {
    const registration_number = req.session.user ? req.session.user.id : null;

    if (!registration_number) {
      console.error('Registration number is missing from session');
      return res.status(400).json({ error: 'Registration number is missing from session' });
    }

    const registeredCourses = await pool.query(
      `SELECT
        c.code,
        c.name,
        c.semester,
        c.compulsory,
        c.department
       FROM academics.course_registrations cr
       JOIN academics.courses c ON cr.course_code = c.code
       WHERE cr.registration_number = $1`,
      [registration_number]
    );

    if (registeredCourses.rows.length === 0) {
      return res.status(404).json({ error: 'No registered courses found' });
    }

    res.json(registeredCourses.rows);
  } catch (error) {
    console.error('Error fetching registered courses:', error);
    res.status(500).send('Failed to fetch registered courses');
  }
});



  app.get('/research-programs', async (req, res) => {
    try {
      // Query the database for courses
      const result = await pool.query('SELECT * FROM academics.research_programs');
      
      // Send the results as JSON
      res.json(result.rows);
    } catch (err) {
      console.error('Error fetching research programs:', err);
      res.status(500).send('Server error');
    }
  });


app.get('/quotations', async (req, res) => {
  try {
    // Query the database for courses
    const result = await pool.query('SELECT * FROM academics.program_quotations');
    
    // Send the results as JSON
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching quotations:', err);
    res.status(500).send('Server error');
  }
});


// Function to update the JSON file with data from the database
const updateJsonFile = async (tableName, filePath) => {
  try {
    const result = await pool.query(`SELECT * FROM academics.${tableName}`);
    fs.writeFile(filePath, JSON.stringify(result.rows, null, 2), (err) => {
      if (err) {
        console.error('Error writing JSON file:', err);
      } else {
        console.log(`${tableName} JSON file updated successfully`);
      }
    });
  } catch (err) {
    console.error('Error fetching data from database:', err);
  }
};

// Schedule the JSON file updates
cron.schedule('0 * * * *', () => updateJsonFile('research_programs', filePaths.research));
cron.schedule('0 * * * *', () => updateJsonFile('counseling_services', filePaths.counseling));
cron.schedule('0 * * * *', () => updateJsonFile('counselors', filePaths.counselors));
cron.schedule('0 * * * *', () => updateJsonFile('counselingresources', filePaths.resources));
cron.schedule('0 * * * *', () => updateJsonFile('opportunities', filePaths.opportunities));
cron.schedule('0 * * * *', () => updateJsonFile('scholarships_and_grants', filePaths.scholarships));
cron.schedule('0 * * * *', () => updateJsonFile('policy_details', filePaths.policies));
cron.schedule('0 0 * * 0', () => updateJsonFile('program_quotations', filePaths.quotations));
cron.schedule('0 * * * *', () => updateJsonFile('clubs_and_societies', filePaths.clubs_and_societies));// Add this line
cron.schedule('0 * * * *', () => updateJsonFile('sports_and_recreation', filePaths.sports_and_recreation));
cron.schedule('0 * * * *', () => updateJsonFile('events_and_workshops', filePaths.events_and_workshops));
cron.schedule('0 * * * *', () => updateJsonFile('university_resources', filePaths.university_resources));
cron.schedule('0 * * * *', () => updateJsonFile('discussion_forums', filePaths.discussion_forums));

cron.schedule('0 * * * *', () => updateJsonFile('alumni', filePaths.alumni));


app.get('/scholarships',async (req, res) => {
  try {
    // Query the database for courses
    const result = await pool.query('SELECT * FROM academics.scholarships_and_grants');
    
    // Send the results as JSON
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching scholarships:', err);
    res.status(500).send('Server error');
  }
});


app.get('/policies', async (req, res) => {
  try {
    // Query the database for courses
    const result = await pool.query('SELECT * FROM academics.policy_details');
    
    // Send the results as JSON
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching policies:', err);
    res.status(500).send('Server error');
  }
});


app.get('/policies/:id', async (req, res) => {
  const policyId = parseInt(req.params.id, 10);

  if (isNaN(policyId)) {
    return res.status(400).send('Invalid policy ID');
  }

  try {
    // Query the database for the specific policy
    const result = await pool.query('SELECT * FROM academics.policy_details WHERE id = $1', [policyId]);

    if (result.rows.length > 0) {
      res.json(result.rows[0]); // Send the specific policy as JSON
    } else {
      res.status(404).send('Policy not found');
    }
  } catch (err) {
    console.error('Error fetching policy:', err);
    res.status(500).send('Server error');
  }
});

app.get('/counseling-services', async (req, res) => {
  try {
    // Query the database for courses
    const result = await pool.query('SELECT * FROM academics.counseling_services');
    
    // Send the results as JSON
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching counseling-services:', err);
    res.status(500).send('Server error');
  }
});
app.get('/counselors', async(req, res) => {
  try {
    // Query the database for courses
    const result = await pool.query('SELECT * FROM academics.counselors');
    
    // Send the results as JSON
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching counselors:', err);
    res.status(500).send('Server error');
  }
});

app.get('/sports-and-recreation', async (req, res) => {
  try {
    // Query the database for courses
    const result = await pool.query('SELECT * FROM academics.sports_and_recreation');
    
    // Send the results as JSON
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching sports and recreation:', err);
    res.status(500).send('Server error');
  }
});
app.get('/events-and-workshops', async(req, res) => {
  try {
    // Query the database for courses
    const result = await pool.query('SELECT * FROM academics.events_and_workshops');
    
    // Send the results as JSON
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching events and workshops:', err);
    res.status(500).send('Server error');
  }
});
app.get('/clubs-and-societies', async(req, res) => {
  try {
    // Query the database for courses
    const result = await pool.query('SELECT * FROM academics.clubs_and_societies');
    
    // Send the results as JSON
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching clubs and societies:', err);
    res.status(500).send('Server error');
  }
});
app.get('/university-resources', async (req, res) => {
  try {
    // Query the database for courses
    const result = await pool.query('SELECT * FROM academics.university_resources');
    
    // Send the results as JSON
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching university resources:', err);
    res.status(500).send('Server error');
  }
});
app.get('/offcampus', async (req, res) => {
  try {
    const results = await pool.query(
      `SELECT * FROM academics.private_accommodation`
    );
    res.json(results.rows);
  } catch (error) {
    console.error('Error fetching offcampus data from database:', error);
    res.status(500).send('Failed to fetch offcampus data');
  }
});
app.get('/images/:houseId', async (req, res) => {
  const houseId = parseInt(req.params.houseId);
  try {
    const result = await pool.query('SELECT picture_data FROM academics.house_images WHERE house_id = $1', [houseId]);
    if (result.rows.length > 0) {
      const images = result.rows.map(row => row.picture_data.toString('base64'));
      res.json(images);
    } else {
      res.status(404).send('No images found for this house');
    }
  } catch (err) {
    console.error('Error retrieving images:', err);
    res.status(500).send('Error retrieving images');
  }
});
app.get('/announcements', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM academics.announcements');
    const announcements = result.rows.map(row => ({
      ...row,
      imagedata: row.imagedata.toString('base64') // Convert binary data to base64
    }));
    res.json(announcements);
  } catch (error) {
    console.error('Error fetching announcements:', error);
    res.status(500).send('Failed to fetch announcements');
  }
});


app.get('/discussion-forums', async(req, res) => {
  try {
    // Query the database for courses
    const result = await pool.query('SELECT * FROM academics.discussion_forums');
    
    // Send the results as JSON
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching dscussion forums :', err);
    res.status(500).send('Server error');
  }
});
app.get('/fetch-opportunities', async (req, res) => {
  try {
    await fetchAndStoreOpportunities();
    res.send('Opportunities fetched and stored successfully.');
  } catch (error) {
    res.status(500).send('Error fetching opportunities.');
  }
});
app.get('/opportunities', async (req, res) => {
  try {
    // Query to fetch opportunities from the database
    const result = await pool.query(`
      SELECT id, "name", category, mentor, company, description, download_link
      FROM academics.opportunities
    `);

    // Send the result as JSON
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching opportunities from database:', error);
    res.status(500).send('Server error');
  }
});

app.get('/alumni', async(req, res) => {
  try {
    // Query the database for courses
    const result = await pool.query('SELECT * FROM academics.alumni');
    
    // Send the results as JSON
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching alumni:', err);
    res.status(500).send('Server error');
  }
});
app.get('/rooms', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM academics.study_rooms');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching rooms:', err);
    res.status(500).send('Server error');
  }
});



app.post('/bookings', async (req, res) => {
  const { room_id, booked_by, start_time, end_time, booking_date, status } = req.body;

  if (!room_id || !booked_by || !start_time || !end_time || !booking_date) {
    return res.status(400).send('All fields are required');
  }

  try {
    const startTime = new Date(start_time);
    const endTime = new Date(end_time);
    const bookingDate = new Date(booking_date);

    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime()) || isNaN(bookingDate.getTime())) {
      throw new Error('Invalid date format');
    }

    // Check if the room is already booked in the specified time range
    const result = await pool.query(
      `SELECT COUNT(*) FROM academics.study_room_bookings
       WHERE room_id = $1
         AND booking_date = $2
         AND (
           (start_time < $4 AND end_time > $3) OR
           (start_time < $3 AND end_time > $3) OR
           (start_time < $4 AND end_time > $4)
         )`,
      [room_id, bookingDate.toISOString().split('T')[0], startTime.toISOString(), endTime.toISOString()]
    );

    const count = parseInt(result.rows[0].count, 10);

    if (count > 0) {
      return res.status(409).send('The room is already booked for the specified time.');
    }

    // Insert the new booking
    await pool.query(
      `INSERT INTO academics.study_room_bookings (room_id, booked_by, start_time, end_time, booking_date, status)
      VALUES ($1, $2, $3, $4, $5, $6)`,
      [room_id, booked_by, startTime.toISOString(), endTime.toISOString(), bookingDate.toISOString().split('T')[0], status]
    );

    // Update room availability
    await pool.query(
      `UPDATE academics.study_rooms
       SET availability = 'Booked'
       WHERE id = $1`,
      [room_id]
    );

    res.status(201).send('Booking created');
  } catch (err) {
    console.error('Error creating booking:', err);
    if (err.message === 'Invalid date format') {
      res.status(400).send('Invalid date format');
    } else {
      res.status(500).send('Server error');
    }
  }
});
app.post('/update-room-availability', async (req, res) => {
  const { room_id } = req.body;

  if (!room_id) {
    return res.status(400).send('Room ID is required');
  }

  try {
    await pool.query(
      `UPDATE academics.study_rooms
       SET status = 'available'
       WHERE id = $1`,
      [room_id]
    );
    res.status(200).send('Room status updated to available');
  } catch (err) {
    console.error('Error updating room status:', err);
    res.status(500).send('Server error');
  }
});

// Function to update room availability based on booking end time
const updateExpiredBookings = async () => {
  try {
    const now = new Date();

    const result = await pool.query(
      `SELECT room_id FROM academics.study_room_bookings
       WHERE end_time < $1 AND status = 'booked'`,
      [now.toISOString()]
    );

    const roomIds = result.rows.map(row => row.room_id);

    if (roomIds.length > 0) {

      await Promise.all(roomIds.map(async (room_id) => {
        await pool.query(
          `UPDATE academics.study_rooms
           SET status = 'available'
           WHERE id = $1`,
          [room_id]
        );
      }));


      await pool.query(
        `UPDATE academics.study_room_bookings
         SET status = 'expired'
         WHERE end_time < $1`,
        [now.toISOString()]
      );

      console.log('Expired bookings processed and room statuses updated');
    }
  } catch (err) {
    console.error('Error updating expired bookings:', err);
  }
};
cron.schedule('*/15 * * * *', updateExpiredBookings);


app.get('/results', async (req, res) => {
  try {

    const registration_number = req.session.user ? req.session.user.id : null;

    if (!registration_number) {
      console.error('Registration number is missing from session');
      return res.status(400).json({ error: 'Registration number is missing from session' });
    }


    const results = await db.any(`
      SELECT
        sr.id,
        sr.registration_number,
        sr.course_code,
        sr.result,
        c.name AS course_name,
        c.semester,
        sr.created_at
      FROM
        academics.student_results sr
      JOIN
        academics.courses c ON sr.course_code = c.code
      WHERE
        sr.registration_number = $1
      ORDER BY
        sr.created_at DESC
    `, [registration_number]);

    res.json(results);
  } catch (error) {
    console.error('Error fetching results:', error);
    res.status(500).json({ error: 'Failed to fetch results' });
  }
});

app.get('/assessments', async (req, res) => {
  try {
    const registration_number = req.session.user ? req.session.user.id : null;

    if (!registration_number) {
      console.error('Registration number is missing from session');
      return res.status(400).json({ error: 'Registration number is missing from session' });
    }

    const query = `
      SELECT sa.id, sa.student_id, s.name AS student_name, c.code AS course_code, c.name AS course_name,
             sa.assessment_1, sa.assessment_2, sa.assessment_3, sa.assessment_4, sa.assessment_5, sa.total
      FROM academics.student_assessments sa
      JOIN academics.students s ON sa.student_id = s.registration_number
      JOIN academics.courses c ON sa.course_code = c.code
      WHERE sa.student_id = $1
      ORDER BY sa.created_at DESC
    `;

    console.log('Executing query:', query);

    const { rows: assessments } = await pool.query(query, [registration_number]);

    if (assessments.length === 0) {
      console.log('No assessments found for registration_number:', registration_number);
      return res.status(404).json({ error: 'No assessments found for the current session' });
    }

    res.json(assessments);
  } catch (error) {
    console.error('Error fetching assessments:', error.message);
    res.status(500).json({ error: 'Failed to fetch assessments', details: error.message });
  }
});

app.get('/events', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM academics.special_days');
    res.json(result.rows); // Ensure the result is in JSON format
  } catch (err) {
    console.error('Error fetching special days:', err);
    res.status(500).send('Server error');
  }
});
app.post('/add-personal-date', async (req, res) => {
  try {
    const { date, type, description } = req.body; // Include description in request body
    const registration_number = req.session.user ? req.session.user.id : null;

    if (!registration_number) {
      return res.status(400).json({ error: 'Registration number is missing from session' });
    }

    if (!date || !type || !description) { // Check that all required fields are provided
      return res.status(400).json({ error: 'Date, type, and description are required' });
    }

    console.log('Adding date:', { registration_number, date, type, description });

    await db.none(
      `INSERT INTO academics.student_personal_dates (registration_number, date, type, description) VALUES ($1, $2, $3, $4)`,
      [registration_number, date, type, description]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error adding personal date:', error);
    res.status(500).send('Failed to add personal date');
  }
});


app.get('/personal-dates', async (req, res) => {
  try {
    const registration_number = req.session.user ? req.session.user.id : null;

    if (!registration_number) {
      console.error('Registration number is missing from session');
      return res.status(400).json({ error: 'Registration number is missing from session' });
    }

    const personalDates = await db.any(
      `SELECT id, date, type, description, created_at
       FROM academics.student_personal_dates
       WHERE registration_number = $1
       ORDER BY date`,
      [registration_number]
    );

    // Ensure the response is always an array
    res.json(personalDates.length > 0 ? personalDates : []);
  } catch (error) {
    console.error('Error fetching personal dates:', error);
    res.status(500).send('Failed to fetch personal dates');
  }
});

// Delete a personal date
app.delete('/delete-personal-date', async (req, res) => {
  try {
    const registration_number = req.session.user ? req.session.user.id : null;
    const { id } = req.body;

    if (!registration_number) {
      console.error('Registration number is missing from session');
      return res.status(400).json({ error: 'Registration number is missing from session' });
    }

    if (!id) {
      console.error('Date ID is required');
      return res.status(400).json({ error: 'Date ID is required' });
    }

    // Check if the personal date exists for the user
    const dateExists = await db.oneOrNone(
      `SELECT id
       FROM academics.student_personal_dates
       WHERE id = $1 AND registration_number = $2`,
      [id, registration_number]
    );

    if (!dateExists) {
      return res.status(404).json({ error: 'Personal date not found' });
    }

    // Delete the personal date
    await db.none(
      `DELETE FROM academics.student_personal_dates
       WHERE id = $1 AND registration_number = $2`,
      [id, registration_number]
    );

    res.status(200).json({ message: 'Personal date deleted successfully' });
  } catch (error) {
    console.error('Error deleting personal date:', error);
    res.status(500).send('Failed to delete personal date');
  }
});




// Start the server
server.listen(3000, () => {
  console.log('Server is running on port 3000');
});
