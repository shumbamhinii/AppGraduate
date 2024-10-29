const http = require('http');
const WebSocket = require('ws');
const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: 'postgresql://postgres.njxnfubjncszurmhtfoc:Hunzamabhisvo%2319@aws-0-eu-central-1.pooler.supabase.com:6543/postgres',
});

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json());
app.use(session({
  store: new pgSession({
    pool: pool,
    tableName: 'session',
    schemaName: 'academics',
  }),
  secret: process.env.SESSION_SECRET || 'your_secret_key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true if using HTTPS
    maxAge: null,
  },
}));

// Login route to establish a session
app.post('/login', (req, res) => {
  // Here you would typically authenticate the user
  req.session.user = { id: 'your_user_id' }; // Store user data in the session
  res.send('Logged in');
});

// Function to normalize phone numbers by removing spaces and non-numeric characters except "+"
const normalizePhoneNumber = (phoneNumber) => {
  return phoneNumber.replace(/[^\d+]/g, ''); // Keep only digits and the "+" symbol
};

// WebSocket connection
wss.on('connection', (ws, request) => {
  console.log('Client connected');

  const cookies = request.headers.cookie || '';
  let sessionId = null;

  // Extract session ID from cookies
  cookies.split(';').forEach(cookie => {
    if (cookie.trim().startsWith('connect.sid=')) {
      sessionId = decodeURIComponent(cookie.split('=')[1].split('.')[0]); // Decode and handle signed cookies
    }
  });

  // Temporarily comment out session validation (you can uncomment after ensuring proper validation)
  /*
  if (sessionId) {
    pool.query('SELECT sess FROM academics.session WHERE sid = $1', [sessionId])
      .then(result => {
        if (result.rows.length > 0) {
          ws.session = JSON.parse(result.rows[0].sess);
          console.log('Session data:', ws.session); // Log the session data for debugging
        } else {
          console.error('Session not found');
          ws.close(4000, 'Authentication error');
        }
      })
      .catch(err => {
        console.error('Session query error:', err);
        ws.close(4000, 'Authentication error');
      });
  } else {
    console.error('No session ID found');
    ws.close(4000, 'Authentication error');
  }
  */

  // Assign the phone number to the WebSocket connection (you'll pass the phone number in a message)
  ws.on('message', async (message) => {
    const messageString = message.toString();
    console.log('Received:', messageString);

    try {
      const { sender, receiver, text } = JSON.parse(messageString);

      // Normalize the sender and receiver phone numbers
      const normalizedSender = normalizePhoneNumber(sender);
      const normalizedReceiver = normalizePhoneNumber(receiver);

      // Store the normalized sender's phone number in the WebSocket instance
      ws.senderPhoneNumber = normalizedSender;

      // Step 1: Insert the message into the database
      await pool.query(
        'INSERT INTO academics.messages (sender_phone_number, receiver_phone_number, message) VALUES ($1, $2, $3)',
        [normalizedSender, normalizedReceiver, text]
      );

      // Step 2: Update the chats table with the last message details
      await pool.query(
        `INSERT INTO academics.chats (user_phone_number, contact_phone_number, last_message, last_message_timestamp)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
         ON CONFLICT (user_phone_number, contact_phone_number)
         DO UPDATE SET last_message = $3, last_message_timestamp = CURRENT_TIMESTAMP`,
        [
          normalizedSender,
          normalizedReceiver,
          text,
        ]
      );

      // Step 3: Send the message only to the client with the matching normalized receiver's phone number
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN && client.senderPhoneNumber === normalizedReceiver) {
          client.send(JSON.stringify({ sender: normalizedSender, receiver: normalizedReceiver, text }));
        }
      });
    } catch (error) {
      console.error('Error handling message:', error);
    }
  });

  ws.on('close', (code, reason) => {
    console.log(`Client disconnected (Code: ${code}, Reason: ${reason})`);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

server.listen(4000, () => {
  console.log('Server is running on port 4000');
});
