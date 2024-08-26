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
  connectionString: process.env.DATABASE_URL,
});

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json()); // For parsing application/json
app.use(cors()); // Enable CORS

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

  // Extract session ID from cookies
  const cookies = request.headers.cookie || '';
  const sessionCookie = cookies.split(';').find(cookie => cookie.trim().startsWith('connect.sid='));

  if (!sessionCookie) {
    console.error('No session ID found in cookies');
    ws.close(4000, 'Authentication error');
    return;
  }

  const sessionId = sessionCookie.split('=')[1];
  console.log('Session ID extracted:', sessionId);

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

server.listen(3000, () => {
  console.log('Server is running on port 3000');
});
