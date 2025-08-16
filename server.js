const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { db } = require('./firebase-config');

const app = express();

// Initialize default users
async function initializeDefaultUsers() {
  try {
    const adminDoc = await db.collection('users').where('email', '==', 'admin@eclinic.com').get();
    if (adminDoc.empty) {
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
      
      console.log('Default users created');
    }
  } catch (error) {
    console.error('Error initializing users:', error);
  }
}

initializeDefaultUsers();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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
app.post('/api/auth/register', async (req, res) => {
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

app.post('/api/auth/login', async (req, res) => {
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

app.get('/api/auth/profile', auth, async (req, res) => {
  try {
    const userDoc = await db.collection('users').doc(req.userId).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const user = { id: userDoc.id, ...userDoc.data() };
    delete user.password;
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Appointment routes
app.get('/api/appointments/doctors', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, email, specialization, experience FROM users WHERE role = $1', ['doctor']);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/appointments/book', auth, async (req, res) => {
  try {
    const { doctorId, date, time, symptoms } = req.body;
    
    const result = await pool.query(
      'INSERT INTO appointments (patient_id, doctor_id, date, time, symptoms) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [req.userId, doctorId, date, time, symptoms]
    );
    
    const appointment = result.rows[0];
    
    // Get patient and doctor info
    const patientResult = await pool.query('SELECT id, name, email, phone FROM users WHERE id = $1', [req.userId]);
    const doctorResult = await pool.query('SELECT id, name, specialization FROM users WHERE id = $1', [doctorId]);
    
    const populatedAppointment = {
      ...appointment,
      patient: patientResult.rows[0],
      doctor: doctorResult.rows[0]
    };
    
    res.status(201).json(populatedAppointment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/appointments/my-appointments', auth, async (req, res) => {
  try {
    const userResult = await pool.query('SELECT role FROM users WHERE id = $1', [req.userId]);
    const userRole = userResult.rows[0]?.role;
    
    let query, params;
    if (userRole === 'patient') {
      query = `
        SELECT a.*, 
               p.name as patient_name, p.email as patient_email, p.phone as patient_phone,
               d.name as doctor_name, d.specialization as doctor_specialization
        FROM appointments a
        JOIN users p ON a.patient_id = p.id
        JOIN users d ON a.doctor_id = d.id
        WHERE a.patient_id = $1
        ORDER BY a.date DESC
      `;
      params = [req.userId];
    } else if (userRole === 'doctor') {
      query = `
        SELECT a.*, 
               p.name as patient_name, p.email as patient_email, p.phone as patient_phone,
               d.name as doctor_name, d.specialization as doctor_specialization
        FROM appointments a
        JOIN users p ON a.patient_id = p.id
        JOIN users d ON a.doctor_id = d.id
        WHERE a.doctor_id = $1
        ORDER BY a.date DESC
      `;
      params = [req.userId];
    }
    
    const result = await pool.query(query, params);
    
    const appointments = result.rows.map(row => ({
      id: row.id,
      date: row.date,
      time: row.time,
      symptoms: row.symptoms,
      diagnosis: row.diagnosis,
      prescription: row.prescription,
      status: row.status,
      created_at: row.created_at,
      patient: {
        id: row.patient_id,
        name: row.patient_name,
        email: row.patient_email,
        phone: row.patient_phone
      },
      doctor: {
        id: row.doctor_id,
        name: row.doctor_name,
        specialization: row.doctor_specialization
      }
    }));
    
    res.json(appointments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.patch('/api/appointments/:id/status', auth, async (req, res) => {
  try {
    const { status, diagnosis, prescription } = req.body;
    
    let query = 'UPDATE appointments SET status = $1';
    let params = [status];
    let paramCount = 1;
    
    if (diagnosis) {
      query += `, diagnosis = $${++paramCount}`;
      params.push(diagnosis);
    }
    if (prescription) {
      query += `, prescription = $${++paramCount}`;
      params.push(prescription);
    }
    
    query += ` WHERE id = $${++paramCount} RETURNING *`;
    params.push(req.params.id);
    
    const result = await pool.query(query, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Appointment not found' });
    }
    
    const appointment = result.rows[0];
    
    // Get patient and doctor info
    const patientResult = await pool.query('SELECT id, name, email, phone FROM users WHERE id = $1', [appointment.patient_id]);
    const doctorResult = await pool.query('SELECT id, name, specialization FROM users WHERE id = $1', [appointment.doctor_id]);
    
    const populatedAppointment = {
      ...appointment,
      patient: patientResult.rows[0],
      doctor: doctorResult.rows[0]
    };
    
    res.json(populatedAppointment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Chat routes
app.get('/api/chat/:appointmentId', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*, u.name as sender_name, u.role as sender_role
      FROM chats c
      JOIN users u ON c.sender_id = u.id
      WHERE c.appointment_id = $1
      ORDER BY c.timestamp ASC
    `, [req.params.appointmentId]);
    
    const messages = result.rows.map(row => ({
      id: row.id,
      message: row.message,
      timestamp: row.timestamp,
      sender: {
        _id: row.sender_id,
        name: row.sender_name,
        role: row.sender_role
      }
    }));
    
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/chat/:appointmentId', auth, async (req, res) => {
  try {
    const { message } = req.body;
    
    const result = await pool.query(
      'INSERT INTO chats (appointment_id, sender_id, message) VALUES ($1, $2, $3) RETURNING *',
      [req.params.appointmentId, req.userId, message]
    );
    
    const chat = result.rows[0];
    
    const userResult = await pool.query('SELECT name, role FROM users WHERE id = $1', [req.userId]);
    const sender = userResult.rows[0];
    
    const populatedChat = {
      ...chat,
      sender: {
        _id: req.userId,
        name: sender.name,
        role: sender.role
      }
    };
    
    res.status(201).json(populatedChat);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Admin routes
app.get('/api/admin/users', auth, async (req, res) => {
  try {
    const userResult = await pool.query('SELECT role FROM users WHERE id = $1', [req.userId]);
    if (userResult.rows[0]?.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const result = await pool.query('SELECT id, name, email, role, phone, specialization, experience, created_at FROM users');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/admin/appointments', auth, async (req, res) => {
  try {
    const userResult = await pool.query('SELECT role FROM users WHERE id = $1', [req.userId]);
    if (userResult.rows[0]?.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const result = await pool.query(`
      SELECT a.*, 
             p.name as patient_name, p.email as patient_email,
             d.name as doctor_name, d.specialization as doctor_specialization
      FROM appointments a
      JOIN users p ON a.patient_id = p.id
      JOIN users d ON a.doctor_id = d.id
      ORDER BY a.created_at DESC
    `);
    
    const appointments = result.rows.map(row => ({
      id: row.id,
      date: row.date,
      time: row.time,
      symptoms: row.symptoms,
      diagnosis: row.diagnosis,
      prescription: row.prescription,
      status: row.status,
      createdAt: row.created_at,
      patient: {
        name: row.patient_name,
        email: row.patient_email
      },
      doctor: {
        name: row.doctor_name,
        specialization: row.doctor_specialization
      }
    }));
    
    res.json(appointments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.delete('/api/admin/users/:id', auth, async (req, res) => {
  try {
    const userResult = await pool.query('SELECT role FROM users WHERE id = $1', [req.userId]);
    if (userResult.rows[0]?.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Test database connection
app.get('/api/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ success: true, time: result.rows[0].now, dbUrl: process.env.DB_URL ? 'Set' : 'Not set' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message, dbUrl: process.env.DB_URL ? 'Set' : 'Not set' });
  }
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;