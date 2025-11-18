// API Client for HavHabit Backend
// API Configuration
const API_URL = 'https://havhabit.vercel.app'; // Change to production URL after deployment

class APIClient {
  constructor() {
    this.token = localStorage.getItem('authToken');
  }

  // Helper method for making authenticated requests
  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Request failed');
      }

      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  // Authentication
  async signup(email, password, name) {
    const data = await this.request('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
    
    this.token = data.token;
    localStorage.setItem('authToken', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    
    return data;
  }

  async login(email, password) {
    const data = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    
    this.token = data.token;
    localStorage.setItem('authToken', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    
    return data;
  }

  logout() {
    this.token = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
  }

  isAuthenticated() {
    return !!this.token;
  }

  getCurrentUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  }

  // Habits
  async getHabits() {
    return await this.request('/api/habits', {
      method: 'GET',
    });
  }

  async createHabit(habitData) {
    return await this.request('/api/habits', {
      method: 'POST',
      body: JSON.stringify(habitData),
    });
  }

  async updateHabit(habitId, habitData) {
    return await this.request(`/api/habits/${habitId}`, {
      method: 'PUT',
      body: JSON.stringify(habitData),
    });
  }

  async deleteHabit(habitId) {
    return await this.request(`/api/habits/${habitId}`, {
      method: 'DELETE',
    });
  }

  async toggleHabit(habitId, date) {
    return await this.request(`/api/habits/${habitId}/toggle`, {
      method: 'POST',
      body: JSON.stringify({ date }),
    });
  }
}

// Export singleton instance
const api = new APIClient();
