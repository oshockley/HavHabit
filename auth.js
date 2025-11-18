// Authentication System for HavHabit

const USERS_KEY = 'havhabit:users';
const SESSION_KEY = 'havhabit:session';

// Helper Functions
function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.classList.add('show');
        setTimeout(() => errorDiv.classList.remove('show'), 4000);
    }
}

function hashPassword(password) {
    // Simple hash for demo (in production, use proper backend hashing)
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
        const char = password.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash.toString(36);
}

function getUsers() {
    const users = localStorage.getItem(USERS_KEY);
    return users ? JSON.parse(users) : [];
}

function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function createSession(user) {
    const session = {
        id: user.id,
        email: user.email,
        name: user.name,
        timestamp: Date.now()
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function getSession() {
    const session = localStorage.getItem(SESSION_KEY);
    return session ? JSON.parse(session) : null;
}

function clearSession() {
    localStorage.removeItem(SESSION_KEY);
}

function isLoggedIn() {
    return getSession() !== null;
}

function getCurrentUser() {
    return getSession();
}

function logout() {
    clearSession();
    window.location.href = 'login.html';
}

// Signup Logic
if (document.getElementById('signupForm')) {
    document.getElementById('signupForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('name').value.trim();
        const email = document.getElementById('email').value.trim().toLowerCase();
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        // Validation
        if (!name || !email || !password) {
            showError('All fields are required');
            return;
        }

        if (password.length < 6) {
            showError('Password must be at least 6 characters');
            return;
        }

        if (password !== confirmPassword) {
            showError('Passwords do not match');
            return;
        }

        try {
            // Call backend API
            await api.signup(email, password, name);
            
            // Redirect to onboarding
            window.location.href = 'onboarding.html';
        } catch (error) {
            showError(error.message || 'Signup failed. Please try again.');
        }
    });
}

// Login Logic
if (document.getElementById('loginForm')) {
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value.trim().toLowerCase();
        const password = document.getElementById('password').value;

        if (!email || !password) {
            showError('Email and password are required');
            return;
        }

        try {
            // Call backend API
            await api.login(email, password);
            
            // Redirect to app (onboarding will be checked in index.html)
            window.location.href = 'index.html';
        } catch (error) {
            showError(error.message || 'Invalid email or password');
        }
    });
}
