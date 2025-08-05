import axios from 'axios';
import { User, LoginCredentials, RegisterData, AuthToken } from '../types/auth';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000/api';

const authApi = axios.create({
  baseURL: `${API_BASE_URL}/auth`,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: false,
});

export const authService = {
  login: async (credentials: LoginCredentials): Promise<AuthToken> => {
    try {
      const response = await authApi.post('/login', credentials);
      return response.data;
    } catch (error: any) {
      if (error.response?.data?.detail) {
        throw new Error(error.response.data.detail);
      }
      throw new Error('Login failed. Please check your credentials.');
    }
  },

  register: async (data: RegisterData): Promise<User> => {
    try {
      const response = await authApi.post('/register', data);
      return response.data;
    } catch (error: any) {
      if (error.response?.data?.detail) {
        throw new Error(error.response.data.detail);
      }
      throw new Error('Registration failed. Please try again.');
    }
  },

  getCurrentUser: async (token: string): Promise<User> => {
    try {
      const response = await authApi.get('/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        throw new Error('Session expired. Please login again.');
      }
      throw new Error('Failed to get user information.');
    }
  },

  logout: async (): Promise<void> => {
    try {
      await authApi.post('/logout');
    } catch (error) {
      // Logout can fail silently as we'll clear local storage anyway
      console.warn('Logout request failed:', error);
    }
  },
};