let currentAppointmentId = null;
let selectedAppointment = null;
let appointments = [];

document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    loadUserInfo();
    loadAppointments();
    initializeSocket();
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
            document.getElementById('userName').textContent = `Welcome, Dr. ${user.name}`;
        }
    } catch (error) {
        console.error('Error loading user info:', error);
    }
}

async function loadAppointments() {
    try {
        const response = await apiCall('/api/appointments/my-appointments');
        if (response.ok) {
            appointments = await response.json();
            displayAppointments(appointments);
            displayChatAppointments(appointments);
            displayPatients(appointments);
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
        <div class="appointment-card" onclick="viewAppointmentDetails('${appointment._id}')">
            <div class="appointment-info">
                <h4>${appointment.patient.name}</h4>
                <p><strong>Email:</strong> ${appointment.patient.email}</p>
                <p><strong>Phone:</strong> ${appointment.patient.phone || 'Not provided'}</p>
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

function displayPatients(appointments) {
    const container = document.getElementById('patientsList');
    const completedAppointments = appointments.filter(apt => apt.status === 'completed');
    
    if (completedAppointments.length === 0) {
        container.innerHTML = '<p>No patient records found.</p>';
        return;
    }

    container.innerHTML = completedAppointments.map(appointment => `
        <div class="patient-card">
            <div class="patient-info">
                <h4>${appointment.patient.name}</h4>
                <p><strong>Last Visit:</strong> ${formatDate(appointment.date)}</p>
                <p><strong>Diagnosis:</strong> ${appointment.diagnosis || 'Not provided'}</p>
                <p><strong>Prescription:</strong> ${appointment.prescription || 'Not provided'}</p>
            </div>
        </div>
    `).join('');
}

function viewAppointmentDetails(appointmentId) {
    const appointment = appointments.find(apt => apt._id === appointmentId);
    if (!appointment) return;

    selectedAppointment = appointment;
    
    const details = `
        <div class="appointment-details">
            <p><strong>Patient:</strong> ${appointment.patient.name}</p>
            <p><strong>Email:</strong> ${appointment.patient.email}</p>
            <p><strong>Phone:</strong> ${appointment.patient.phone || 'Not provided'}</p>
            <p><strong>Date:</strong> ${formatDate(appointment.date)}</p>
            <p><strong>Time:</strong> ${appointment.time}</p>
            <p><strong>Status:</strong> ${appointment.status}</p>
            <p><strong>Symptoms:</strong> ${appointment.symptoms || 'Not provided'}</p>
            
            <div class="form-group">
                <label>Diagnosis:</label>
                <textarea id="diagnosisInput" rows="3">${appointment.diagnosis || ''}</textarea>
            </div>
            
            <div class="form-group">
                <label>Prescription:</label>
                <textarea id="prescriptionInput" rows="3">${appointment.prescription || ''}</textarea>
            </div>
        </div>
    `;
    
    document.getElementById('appointmentDetails').innerHTML = details;
    document.getElementById('appointmentModal').style.display = 'block';
}

async function updateAppointmentStatus(status) {
    if (!selectedAppointment) return;

    const updateData = { status };
    
    // Include diagnosis and prescription if provided
    const diagnosis = document.getElementById('diagnosisInput')?.value;
    const prescription = document.getElementById('prescriptionInput')?.value;
    
    if (diagnosis) updateData.diagnosis = diagnosis;
    if (prescription) updateData.prescription = prescription;

    try {
        const response = await apiCall(`/api/appointments/${selectedAppointment._id}/status`, {
            method: 'PATCH',
            body: JSON.stringify(updateData)
        });

        if (response.ok) {
            alert('Appointment updated successfully!');
            closeModal('appointmentModal');
            loadAppointments();
        } else {
            const error = await response.json();
            alert(error.message);
        }
    } catch (error) {
        alert('Error updating appointment');
    }
}

function displayChatAppointments(appointments) {
    const container = document.getElementById('chatAppointments');
    const confirmedAppointments = appointments.filter(apt => apt.status === 'confirmed');
    
    if (confirmedAppointments.length === 0) {
        container.innerHTML = '<p>No confirmed appointments for chat.</p>';
        return;
    }

    container.innerHTML = confirmedAppointments.map(appointment => `
        <div class="chat-appointment-item" onclick="openChat('${appointment._id}', '${appointment.patient.name}')">
            <h4>${appointment.patient.name}</h4>
            <p>${formatDate(appointment.date)} at ${appointment.time}</p>
        </div>
    `).join('');
}

async function openChat(appointmentId, patientName) {
    currentAppointmentId = appointmentId;
    document.getElementById('chatTitle').textContent = `Chat with ${patientName}`;
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