const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();

// In-memory storage (resets on server restart)
let users = [
  {
    id: '1',
    name: 'Admin User',
    email: 'admin@eclinic.com',
    password: '$2a$12$LQv3c1yqBw2uuCD4Gdl30OQ3xvL0Au50cS2Q2b6Ece8aeRXuL.daa', // secret123
    role: 'admin',
    createdAt: new Date()
  },
  {
    id: '2',
    name: 'Dr. Smith',
    email: 'doctor@eclinic.com',
    password: '$2a$12$LQv3c1yqBw2uuCD4Gdl30OQ3xvL0Au50cS2Q2b6Ece8aeRXuL.daa', // secret123
    role: 'doctor',
    specialization: 'General Medicine',
    experience: 5,
    createdAt: new Date()
  }
];
let appointments = [];
let chats = [];
let nextId = 3;

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
    
    if (users.find(u => u.email === email)) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = {
      id: nextId++,
      name, email, 
      password: hashedPassword, 
      role, phone, specialization, experience,
      createdAt: new Date()
    };
    
    users.push(user);
    
    const token = jwt.sign({ userId: user.id }, 'your-secret-key');
    res.status(201).json({ token, user: { id: user.id, name, email, role } });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = users.find(u => u.email === email);
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ userId: user.id }, 'your-secret-key');
    res.json({ token, user: { id: user.id, name: user.name, email, role: user.role } });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/auth/profile', auth, (req, res) => {
  const user = users.find(u => u.id == req.userId);
  if (!user) return res.status(404).json({ message: 'User not found' });
  
  const { password, ...userWithoutPassword } = user;
  res.json(userWithoutPassword);
});

// Appointment routes
app.get('/api/appointments/doctors', (req, res) => {
  const doctors = users.filter(u => u.role === 'doctor').map(({ password, ...doctor }) => doctor);
  res.json(doctors);
});

app.post('/api/appointments/book', auth, (req, res) => {
  const { doctorId, date, time, symptoms } = req.body;
  
  const appointment = {
    id: nextId++,
    patient: req.userId,
    doctor: doctorId,
    date: new Date(date),
    time,
    symptoms,
    status: 'pending',
    createdAt: new Date()
  };
  
  appointments.push(appointment);
  
  const populatedAppointment = {
    ...appointment,
    patient: users.find(u => u.id == req.userId),
    doctor: users.find(u => u.id == doctorId)
  };
  
  res.status(201).json(populatedAppointment);
});

app.get('/api/appointments/my-appointments', auth, (req, res) => {
  const user = users.find(u => u.id == req.userId);
  let userAppointments = [];
  
  if (user.role === 'patient') {
    userAppointments = appointments.filter(apt => apt.patient == req.userId);
  } else if (user.role === 'doctor') {
    userAppointments = appointments.filter(apt => apt.doctor == req.userId);
  }
  
  const populatedAppointments = userAppointments.map(apt => ({
    ...apt,
    patient: users.find(u => u.id == apt.patient),
    doctor: users.find(u => u.id == apt.doctor)
  }));
  
  res.json(populatedAppointments);
});

app.patch('/api/appointments/:id/status', auth, (req, res) => {
  const { status, diagnosis, prescription } = req.body;
  const appointment = appointments.find(apt => apt.id == req.params.id);
  
  if (!appointment) return res.status(404).json({ message: 'Appointment not found' });
  
  appointment.status = status;
  if (diagnosis) appointment.diagnosis = diagnosis;
  if (prescription) appointment.prescription = prescription;
  
  const populatedAppointment = {
    ...appointment,
    patient: users.find(u => u.id == appointment.patient),
    doctor: users.find(u => u.id == appointment.doctor)
  };
  
  res.json(populatedAppointment);
});

// Chat routes
app.get('/api/chat/:appointmentId', auth, (req, res) => {
  const messages = chats.filter(chat => chat.appointment == req.params.appointmentId)
    .map(chat => ({
      ...chat,
      sender: users.find(u => u.id == chat.sender)
    }));
  res.json(messages);
});

app.post('/api/chat/:appointmentId', auth, (req, res) => {
  const { message } = req.body;
  
  const chat = {
    id: nextId++,
    appointment: req.params.appointmentId,
    sender: req.userId,
    message,
    timestamp: new Date()
  };
  
  chats.push(chat);
  
  const populatedChat = {
    ...chat,
    sender: users.find(u => u.id == req.userId)
  };
  
  res.status(201).json(populatedChat);
});

// Admin routes
app.get('/api/admin/users', auth, (req, res) => {
  const user = users.find(u => u.id == req.userId);
  if (user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  
  const usersWithoutPasswords = users.map(({ password, ...user }) => user);
  res.json(usersWithoutPasswords);
});

app.get('/api/admin/appointments', auth, (req, res) => {
  const user = users.find(u => u.id == req.userId);
  if (user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  
  const populatedAppointments = appointments.map(apt => ({
    ...apt,
    patient: users.find(u => u.id == apt.patient),
    doctor: users.find(u => u.id == apt.doctor)
  }));
  
  res.json(populatedAppointments);
});

app.delete('/api/admin/users/:id', auth, (req, res) => {
  const user = users.find(u => u.id == req.userId);
  if (user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  
  users = users.filter(u => u.id != req.params.id);
  res.json({ message: 'User deleted successfully' });
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