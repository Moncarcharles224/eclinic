document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    loadUserInfo();
    loadStats();
    loadUsers();
    loadAppointments();
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
            if (user.role !== 'admin') {
                alert('Access denied. Admin privileges required.');
                logout();
                return;
            }
            document.getElementById('userName').textContent = `Welcome, ${user.name}`;
        }
    } catch (error) {
        console.error('Error loading user info:', error);
    }
}

async function loadStats() {
    try {
        const [usersResponse, appointmentsResponse] = await Promise.all([
            apiCall('/api/admin/users'),
            apiCall('/api/admin/appointments')
        ]);

        if (usersResponse.ok && appointmentsResponse.ok) {
            const users = await usersResponse.json();
            const appointments = await appointmentsResponse.json();

            const doctors = users.filter(user => user.role === 'doctor');
            const patients = users.filter(user => user.role === 'patient');

            document.getElementById('totalUsers').textContent = users.length;
            document.getElementById('totalDoctors').textContent = doctors.length;
            document.getElementById('totalPatients').textContent = patients.length;
            document.getElementById('totalAppointments').textContent = appointments.length;
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

async function loadUsers() {
    try {
        const response = await apiCall('/api/admin/users');
        if (response.ok) {
            const users = await response.json();
            displayUsers(users);
        }
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

function displayUsers(users) {
    const container = document.getElementById('usersList');
    if (users.length === 0) {
        container.innerHTML = '<p>No users found.</p>';
        return;
    }

    container.innerHTML = `
        <table class="admin-table">
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Phone</th>
                    <th>Specialization</th>
                    <th>Joined</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${users.map(user => `
                    <tr>
                        <td>${user.name}</td>
                        <td>${user.email}</td>
                        <td><span class="role ${user.role}">${user.role}</span></td>
                        <td>${user.phone || 'N/A'}</td>
                        <td>${user.specialization || 'N/A'}</td>
                        <td>${formatDate(user.createdAt)}</td>
                        <td>
                            <button class="btn-danger btn-small" onclick="deleteUser('${user._id}', '${user.name}')">Delete</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

async function loadAppointments() {
    try {
        const response = await apiCall('/api/admin/appointments');
        if (response.ok) {
            const appointments = await response.json();
            displayAppointments(appointments);
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

    container.innerHTML = `
        <table class="admin-table">
            <thead>
                <tr>
                    <th>Patient</th>
                    <th>Doctor</th>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Status</th>
                    <th>Symptoms</th>
                    <th>Created</th>
                </tr>
            </thead>
            <tbody>
                ${appointments.map(appointment => `
                    <tr>
                        <td>${appointment.patient.name}</td>
                        <td>Dr. ${appointment.doctor.name}</td>
                        <td>${formatDate(appointment.date)}</td>
                        <td>${appointment.time}</td>
                        <td><span class="status ${appointment.status}">${appointment.status}</span></td>
                        <td>${appointment.symptoms || 'N/A'}</td>
                        <td>${formatDate(appointment.createdAt)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

async function deleteUser(userId, userName) {
    if (confirm(`Are you sure you want to delete user "${userName}"? This action cannot be undone.`)) {
        try {
            const response = await apiCall(`/api/admin/users/${userId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                alert('User deleted successfully!');
                loadUsers();
                loadStats();
            } else {
                const error = await response.json();
                alert(error.message);
            }
        } catch (error) {
            alert('Error deleting user');
        }
    }
}

function showSection(sectionId) {
    document.querySelectorAll('.dashboard-section').forEach(section => {
        section.classList.remove('active');
    });
    document.querySelectorAll('.sidebar-menu a').forEach(link => {
        link.classList.remove('active');
    });
    
    document.getElementById(sectionId).classList.add('active');
    document.querySelector(`[onclick="showSection('${sectionId}')"]`).classList.add('active');
    
    // Reload data when switching sections
    if (sectionId === 'overview') {
        loadStats();
    } else if (sectionId === 'users') {
        loadUsers();
    } else if (sectionId === 'appointments') {
        loadAppointments();
    }
}