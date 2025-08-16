// Global variables
let currentUser = null;
let socket = null;

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    checkAuthStatus();
    initializeEventListeners();
});

// Check if user is logged in
function checkAuthStatus() {
    const token = localStorage.getItem('token');
    if (token) {
        fetchUserProfile();
    }
}

// Initialize event listeners
function initializeEventListeners() {
    // Login form
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    
    // Register form
    document.getElementById('registerForm').addEventListener('submit', handleRegister);
    
    // Role change for doctor fields
    document.getElementById('registerRole').addEventListener('change', function() {
        const doctorFields = document.getElementById('doctorFields');
        if (this.value === 'doctor') {
            doctorFields.style.display = 'block';
        } else {
            doctorFields.style.display = 'none';
        }
    });
}

// Navigation functions
function toggleMenu() {
    const navMenu = document.getElementById('navMenu');
    navMenu.classList.toggle('active');
}

function showLogin() {
    closeModal('registerModal');
    document.getElementById('loginModal').style.display = 'block';
}

function showRegister() {
    closeModal('loginModal');
    document.getElementById('registerModal').style.display = 'block';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Authentication functions
async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            localStorage.setItem('token', data.token);
            currentUser = data.user;
            closeModal('loginModal');
            redirectToDashboard();
        } else {
            alert(data.message);
        }
    } catch (error) {
        alert('Login failed. Please try again.');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    
    const formData = {
        name: document.getElementById('registerName').value,
        email: document.getElementById('registerEmail').value,
        phone: document.getElementById('registerPhone').value,
        password: document.getElementById('registerPassword').value,
        role: document.getElementById('registerRole').value
    };
    
    if (formData.role === 'doctor') {
        formData.specialization = document.getElementById('registerSpecialization').value;
        formData.experience = document.getElementById('registerExperience').value;
    }
    
    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            localStorage.setItem('token', data.token);
            currentUser = data.user;
            closeModal('registerModal');
            redirectToDashboard();
        } else {
            alert(data.message);
        }
    } catch (error) {
        alert('Registration failed. Please try again.');
    }
}

async function fetchUserProfile() {
    const token = localStorage.getItem('token');
    
    try {
        const response = await fetch('/api/auth/profile', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            currentUser = await response.json();
            redirectToDashboard();
        } else {
            localStorage.removeItem('token');
        }
    } catch (error) {
        localStorage.removeItem('token');
    }
}

function logout() {
    localStorage.removeItem('token');
    currentUser = null;
    if (socket) {
        socket.disconnect();
    }
    window.location.href = '/';
}

function redirectToDashboard() {
    if (currentUser) {
        switch (currentUser.role) {
            case 'patient':
                window.location.href = '/pages/patient-dashboard.html';
                break;
            case 'doctor':
                window.location.href = '/pages/doctor-dashboard.html';
                break;
            case 'admin':
                window.location.href = '/pages/admin-dashboard.html';
                break;
        }
    }
}

// API helper function
async function apiCall(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    };
    
    const finalOptions = { ...defaultOptions, ...options };
    if (options.headers) {
        finalOptions.headers = { ...defaultOptions.headers, ...options.headers };
    }
    
    const response = await fetch(endpoint, finalOptions);
    
    if (response.status === 401) {
        logout();
        return;
    }
    
    return response;
}

// Socket.io initialization
function initializeSocket() {
    socket = io();
    
    socket.on('connect', () => {
        console.log('Connected to server');
    });
    
    socket.on('receive-message', (data) => {
        displayMessage(data);
    });
}

// Chat functions
function joinChatRoom(appointmentId) {
    if (socket) {
        socket.emit('join-room', appointmentId);
    }
}

function sendMessage(appointmentId, message) {
    if (socket && message.trim()) {
        const messageData = {
            roomId: appointmentId,
            message: message,
            sender: currentUser.name,
            timestamp: new Date()
        };
        
        socket.emit('send-message', messageData);
        
        // Also save to database
        apiCall(`/api/chat/${appointmentId}`, {
            method: 'POST',
            body: JSON.stringify({ message })
        });
    }
}

function displayMessage(data) {
    const messagesContainer = document.getElementById('chatMessages');
    if (messagesContainer) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${data.sender === currentUser.name ? 'sent' : 'received'}`;
        messageDiv.innerHTML = `
            <div class="message-content">${data.message}</div>
            <div class="message-time">${new Date(data.timestamp).toLocaleTimeString()}</div>
        `;
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

// Utility functions
function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString();
}

function formatTime(timeString) {
    return new Date(`2000-01-01 ${timeString}`).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
    });
}