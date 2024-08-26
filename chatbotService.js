const axios = require('axios');
const fs = require('fs');

const API_URL = 'https://api-inference.huggingface.co/models/facebook/blenderbot-1B-distill';
const API_KEY = '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';

const logResponse = (message, response) => {
  console.log(`Message: ${message}`);
  console.log(`Response: ${response}`);
  const logEntry = `Message: ${message}\nResponse: ${response}\n\n`;
  fs.appendFile('chatbot_logs.txt', logEntry, err => {
    if (err) {
      console.error('Error writing to log file:', err.message);
    }
  });
};

const getBotResponse = async (message, session) => {
  try {
    console.log('Session before processing:', session);

    if (session.reset || (!session.registrationNumber && !session.courseCode)) {
      console.log('Resetting session data.');
      session.registrationNumber = null;
      session.courseCode = null;
      session.reset = false;
    }

    if (message.toLowerCase().includes('missing course')) {
      if (!session.registrationNumber) {
        return 'Please provide your registration number.';
      } else if (!session.courseCode) {
        return 'Please provide the course code for the missing course.';
      } else {
        return await handleRegistrationIssue(session.registrationNumber, session.courseCode);
      }
    }

    if (message.toLowerCase().includes('check my courses')) {
      if (!session.registrationNumber) {
        return 'Please provide your registration number to check your courses.';
      } else {
        return await checkRegisteredCourses(session.registrationNumber);
      }
    }

    if (!session.registrationNumber) {
      if (message.match(/^[A-Z0-9]{7,10}$/)) {
        session.registrationNumber = message.trim();
        console.log('Registration number stored:', session.registrationNumber);
        return 'Thank you! Now, please provide the course code for the missing course.';
      } else {
        return 'Please provide your registration number.';
      }
    }

    if (session.registrationNumber && !session.courseCode) {
      const courseCodeMatch = message.match(/\b[A-Z0-9]{3,6}\b/);
      if (courseCodeMatch) {
        const courseCode = courseCodeMatch[0].trim();
        if (isValidCourseCode(courseCode)) {
          session.courseCode = courseCode;
          console.log('Course code stored:', session.courseCode);
          return await handleRegistrationIssue(session.registrationNumber, session.courseCode);
        } else {
          return 'The provided course code is not valid. Please provide a valid course code.';
        }
      } else {
        return 'Thank you for providing your registration number. Please provide the course code for the missing course.';
      }
    }

    const response = await axios.post(
      API_URL,
      { inputs: message },
      { headers: { Authorization: `Bearer ${API_KEY}` } }
    );

    let botResponse = response.data[0]?.generated_text || 'Sorry, I didn’t get that.';
    botResponse = botResponse.replace(/Sarah/g, 'Pookie');
    logResponse(message, botResponse);

    return botResponse;
  } catch (error) {
    console.error('Error communicating with Hugging Face:', error.message);
    return 'Sorry, I encountered an error.';
  }
};

const handleRegistrationIssue = async (registrationNumber, courseCode) => {
  try {
    const response = await axios.post(
      'http://localhost:3000/register-courses',
      { courses: [courseCode] },
      {
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `session_id=${registrationNumber}`,
        },
      }
    );

    if (response.status === 200) {
      return `The course ${courseCode} has been successfully registered for your account.`;
    } else {
      return `There was an issue registering the course ${courseCode}. Please try again later.`;
    }
  } catch (error) {
    console.error('Error registering course through server:', error.message);
    return 'Sorry, I encountered an error while registering your course.';
  }
};

const isValidCourseCode = (code) => {
  return /^[A-Z0-9]{3,6}$/.test(code);
};

module.exports = getBotResponse;
