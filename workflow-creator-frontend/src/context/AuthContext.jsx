import React, { createContext, useState, useContext, useEffect } from 'react';
import apiClient from '../lib/api';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

const AuthContext = createContext(null);

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const verifyUser = async () => {
      const storedToken = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');
      
      console.log('[AUTH_CONTEXT] Verifying user on mount...');
      console.log('[AUTH_CONTEXT] Stored token exists:', !!storedToken);
      console.log('[AUTH_CONTEXT] Stored user exists:', !!storedUser);
      
      if (storedToken) {
        setToken(storedToken);
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
        console.log('[AUTH_CONTEXT] Set authorization header with token');
        try {
          
          if (storedUser) {
            const userData = JSON.parse(storedUser);
            setUser(userData);
            console.log('[AUTH_CONTEXT] Restored user from localStorage:', userData.username);
          }
        } catch (error) {
          console.error('Token verification error:', error);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setToken(null);
          setUser(null);
          delete apiClient.defaults.headers.common['Authorization'];
        }
      } else {
        console.log('[AUTH_CONTEXT] No stored token found');
      }
      setIsLoading(false);
    };
    
    verifyUser();
  }, []);

const login = async (credentials) => {
  setIsLoading(true);
  try {
    const response = await apiClient.post('/auth/login', credentials);
    if (response.data && response.data.token && response.data.data) {
      const { token: newToken, data: userData } = response.data;
      
      localStorage.setItem('token', newToken);
      localStorage.setItem('user', JSON.stringify(userData));
      
      setToken(newToken);
      setUser(userData);
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
      
      toast.success('Login successful! Redirecting...');

      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);

      return { success: true, user: userData };
    }
    throw new Error('Login failed: Invalid response structure from server.');
  } catch (error) {
    const errorMessage = error.response?.data?.message || error.message || 'Login failed. Please check your credentials.';
    console.error('Login error in AuthContext:', errorMessage);
    toast.error(errorMessage);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    delete apiClient.defaults.headers.common['Authorization'];
    return { success: false, error: error.response?.data || error };
  } finally {
    setIsLoading(false);
  }
};

  const register = async (userData) => {
    setIsLoading(true);
    try {
      const payload = {
        ...userData,
        role: userData.role 
      };
      
      if ('isAdmin' in payload) {
        delete payload.isAdmin;
      }

      const response = await apiClient.post('/auth/register', payload);
      toast.success(response.data?.message || 'Registration successful! Please log in.');
      return { success: true, data: response.data };
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || 'Registration failed. Please try again.';
      console.error('Registration error:', errorMessage);
      toast.error(errorMessage);
      return { success: false, error: error.response?.data || error };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      if (token) {
        await apiClient.post('/auth/logout');
      }
    } catch (error) {
      console.error('Logout API call error:', error.response?.data?.message || error.message);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setToken(null);
      setUser(null);
      delete apiClient.defaults.headers.common['Authorization'];
      setIsLoading(false);
      navigate('/login');
    }
  };

  const value = {
    user,
    token,
    isLoading,
    login,
    register,
    logout,
    isAuthenticated: !!user && !!token,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
