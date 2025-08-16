let currentAppointmentId = null;

document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    loadUserInfo();
    loadAppointments();
    loadDoctors();
    initializeSocket();
    setupBookingForm();
});

function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/';
        return;
    }
}

async function loadUserInfo() {
    try {
        const response = await apiCall('/api/auth/profile');
        if (response.ok) {
            const user = await response.json();
            document.getElementById('userName').textContent = `Welcome, ${user.name}`;
        }
    } catch (error) {
        console.error('Error loading user info:', error);
    }
}

async function loadAppointments() {
    try {
        const response = await apiCall('/api/appointments/my-appointments');
        if (response.ok) {
            const appointments = await response.json();
            displayAppointments(appointments);
            displayChatAppointments(appointments);
        }
    } catch (error) {
        console.error('Error loading appointments:', error);
    }
}

function displayAppointments(appointments) {
    const container = document.getElementById('appointmentsList');
    if (appointments.length === 0) {
        container.innerHTML = '<p>No appointments found.</p>';
        return;
    }

    container.innerHTML = appointments.map(appointment => `
        <div class="appointment-card">
            <div class="appointment-info">
                <h4>Dr. ${appointment.doctor.name}</h4>
                <p><strong>Specialization:</strong> ${appointment.doctor.specialization || 'General'}</p>
                <p><strong>Date:</strong> ${formatDate(appointment.date)}</p>
                <p><strong>Time:</strong> ${appointment.time}</p>
                <p><strong>Status:</strong> <span class="status ${appointment.status}">${appointment.status}</span></p>
                ${appointment.symptoms ? `<p><strong>Symptoms:</strong> ${appointment.symptoms}</p>` : ''}
                ${appointment.diagnosis ? `<p><strong>Diagnosis:</strong> ${appointment.diagnosis}</p>` : ''}
                ${appointment.prescription ? `<p><strong>Prescription:</strong> ${appointment.prescription}</p>` : ''}
            </div>
        </div>
    `).join('');
}

async function loadDoctors() {
    try {
        const response = await apiCall('/api/appointments/doctors');
        if (response.ok) {
            const doctors = await response.json();
            const select = document.getElementById('doctorSelect');
            select.innerHTML = '<option value="">Select a doctor</option>' +
                doctors.map(doctor => `
                    <option value="${doctor._id}">Dr. ${doctor.name} - ${doctor.specialization || 'General'}</option>
                `).join('');
        }
    } catch (error) {
        console.error('Error loading doctors:', error);
    }
}

function setupBookingForm() {
    document.getElementById('bookingForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = {
            doctorId: document.getElementById('doctorSelect').value,
            date: document.getElementById('appointmentDate').value,
            time: document.getElementById('appointmentTime').value,
            symptoms: document.getElementById('symptoms').value
        };

        try {
            const response = await apiCall('/api/appointments/book', {
                method: 'POST',
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                alert('Appointment booked successfully!');
                document.getElementById('bookingForm').reset();
                loadAppointments();
                showSection('appointments');
            } else {
                const error = await response.json();
                alert(error.message);
            }
        } catch (error) {
            alert('Error booking appointment');
        }
    });

    // Set minimum date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('appointmentDate').min = today;
}

function displayChatAppointments(appointments) {
    const container = document.getElementById('chatAppointments');
    const confirmedAppointments = appointments.filter(apt => apt.status === 'confirmed');
    
    if (confirmedAppointments.length === 0) {
        container.innerHTML = '<p>No confirmed appointments for chat.</p>';
        return;
    }

    container.innerHTML = confirmedAppointments.map(appointment => `
        <div class="chat-appointment-item" onclick="openChat('${appointment._id}', 'Dr. ${appointment.doctor.name}')">
            <h4>Dr. ${appointment.doctor.name}</h4>
            <p>${formatDate(appointment.date)} at ${appointment.time}</p>
        </div>
    `).join('');
}

async function openChat(appointmentId, doctorName) {
    currentAppointmentId = appointmentId;
    document.getElementById('chatTitle').textContent = `Chat with ${doctorName}`;
    document.getElementById('chatArea').style.display = 'block';
    
    joinChatRoom(appointmentId);
    await loadChatMessages(appointmentId);
}

async function loadChatMessages(appointmentId) {
    try {
        const response = await apiCall(`/api/chat/${appointmentId}`);
        if (response.ok) {
            const messages = await response.json();
            const container = document.getElementById('chatMessages');
            container.innerHTML = messages.map(msg => `
                <div class="message ${msg.sender._id === currentUser.id ? 'sent' : 'received'}">
                    <div class="message-content">${msg.message}</div>
                    <div class="message-time">${new Date(msg.timestamp).toLocaleTimeString()}</div>
                </div>
            `).join('');
            container.scrollTop = container.scrollHeight;
        }
    } catch (error) {
        console.error('Error loading messages:', error);
    }
}

function sendChatMessage() {
    const input = document.getElementById('messageInput');
    const message = input.value.trim();
    
    if (message && currentAppointmentId) {
        sendMessage(currentAppointmentId, message);
        input.value = '';
    }
}

// Handle Enter key in message input
document.addEventListener('keypress', function(e) {
    if (e.target.id === 'messageInput' && e.key === 'Enter') {
        sendChatMessage();
    }
});

function showSection(sectionId) {
    document.querySelectorAll('.dashboard-section').forEach(section => {
        section.classList.remove('active');
    });
    document.querySelectorAll('.sidebar-menu a').forEach(link => {
        link.classList.remove('active');
    });
    
    document.getElementById(sectionId).classList.add('active');
    document.querySelector(`[onclick="showSection('${sectionId}')"]`).classList.add('active');
}