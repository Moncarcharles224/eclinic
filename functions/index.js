const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

admin.initializeApp();
const db = admin.firestore();

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// Initialize default users
async function initUsers() {
  try {
    const adminQuery = await db.collection('users').where('email', '==', 'admin@eclinic.com').get();
    if (adminQuery.empty) {
      await db.collection('users').add({
        name: 'Admin User',
        email: 'admin@eclinic.com',
        password: '$2a$12$LQv3c1yqBw2uuCD4Gdl30OQ3xvL0Au50cS2Q2b6Ece8aeRXuL.daa',
        role: 'admin',
        createdAt: new Date()
      });
      
      await db.collection('users').add({
        name: 'Dr. Smith',
        email: 'doctor@eclinic.com',
        password: '$2a$12$LQv3c1yqBw2uuCD4Gdl30OQ3xvL0Au50cS2Q2b6Ece8aeRXuL.daa',
        role: 'doctor',
        specialization: 'General Medicine',
        experience: 5,
        createdAt: new Date()
      });
    }
  } catch (error) {
    console.log('Init error:', error);
  }
}

initUsers();

// Auth middleware
const auth = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'No token provided' });
  
  try {
    const decoded = jwt.verify(token, 'your-secret-key');
    req.userId = decoded.userId;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

// Auth routes
app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const userQuery = await db.collection('users').where('email', '==', email).get();
    
    if (userQuery.empty) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    const userDoc = userQuery.docs[0];
    const user = { id: userDoc.id, ...userDoc.data() };
    
    if (!(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ userId: user.id }, 'your-secret-key');
    res.json({ token, user: { id: user.id, name: user.name, email, role: user.role } });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/auth/register', async (req, res) => {
  try {
    const { name, email, password, role, phone, specialization, experience } = req.body;
    
    const existingUser = await db.collection('users').where('email', '==', email).get();
    if (!existingUser.empty) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const userDoc = await db.collection('users').add({
      name, email, 
      password: hashedPassword, 
      role, phone, specialization, experience,
      createdAt: new Date()
    });
    
    const token = jwt.sign({ userId: userDoc.id }, 'your-secret-key');
    res.status(201).json({ token, user: { id: userDoc.id, name, email, role } });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Appointments routes
app.get('/appointments/doctors', async (req, res) => {
  try {
    const doctorsQuery = await db.collection('users').where('role', '==', 'doctor').get();
    const doctors = doctorsQuery.docs.map(doc => {
      const data = doc.data();
      delete data.password;
      return { id: doc.id, ...data };
    });
    res.json(doctors);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/appointments/book', auth, async (req, res) => {
  try {
    const { doctorId, date, time, symptoms } = req.body;
    
    const appointmentDoc = await db.collection('appointments').add({
      patientId: req.userId,
      doctorId,
      date: new Date(date),
      time,
      symptoms,
      status: 'pending',
      createdAt: new Date()
    });
    
    res.status(201).json({ id: appointmentDoc.id, message: 'Appointment booked successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Export the API
exports.api = functions.https.onRequest(app);