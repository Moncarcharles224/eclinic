# eClinic - Online Medical Consultation Platform

A simple web application for online medical consultations and appointment booking.

## 🚀 Quick Deploy to GitHub + Vercel

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/eclinic.git
git push -u origin main
```

### 2. Deploy to Vercel
1. Go to [vercel.com](https://vercel.com)
2. Sign in with GitHub
3. Click "New Project"
4. Import your GitHub repository
5. Click "Deploy"

That's it! No database setup needed.

## 📋 Features

- **User Authentication**: Login/Signup for patients, doctors, and admin
- **Appointment Booking**: Patients can book appointments with doctors
- **Dashboard**: Different views for patients, doctors, and admin
- **Chat System**: Real-time messaging between doctors and patients
- **Medical Records**: Doctors can add diagnoses and prescriptions

## 🔑 Default Login Credentials

### Admin
- Email: `admin@eclinic.com`
- Password: `secret123`

### Doctor
- Email: `doctor@eclinic.com`
- Password: `secret123`

### Patient
- Register a new account or use the registration form

## 🛠️ Technology Stack

- **Frontend**: HTML, CSS, JavaScript
- **Backend**: Node.js, Express.js
- **Authentication**: JWT tokens
- **Storage**: In-memory (resets on server restart)
- **Deployment**: Vercel

## 📱 How to Use

1. **Register/Login**: Create account or use default credentials
2. **Patient**: Book appointments, chat with doctors, view medical records
3. **Doctor**: Manage appointments, chat with patients, add diagnoses
4. **Admin**: Manage users and view all appointments

## 🔧 Local Development

```bash
# Install dependencies
npm install

# Start server
npm start

# Visit http://localhost:3000
```

## 📝 Note

This is a demo application with in-memory storage. Data resets when the server restarts. Perfect for testing and demonstrations!