'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  user: any | null;
  loading: boolean;
  login: (credentials: any) => Promise<{ success: boolean; error?: string }>;
  register: (userData: any) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateUser: (updatedData: any) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchSession = async () => {
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Error fetching session:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
  }, []);

  const login = async (credentials: any) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });

      let data;
      try {
        data = await response.json();
      } catch (jsonErr) {
        return { success: false, error: `Server error (${response.status}): Database connection or internal error.` };
      }

      if (response.ok) {
        setUser(data.user);
        // Navigate dynamically depending on user role
        if (data.user.role === 'admin') {
          router.push('/dashboard');
        } else {
          router.push('/dashboard');
        }
        return { success: true };
      } else {
        return { success: false, error: data.error || 'Login failed.' };
      }
    } catch (error: any) {
      return { success: false, error: 'Network error. Please check your connection and try again.' };
    }
  };

  const register = async (userData: any) => {
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });

      let data;
      try {
        data = await response.json();
      } catch (jsonErr) {
        return { success: false, error: `Server error (${response.status}): Database connection or internal error.` };
      }

      if (response.ok) {
        setUser(data.user);
        router.push('/dashboard');
        return { success: true };
      } else {
        return { success: false, error: data.error || 'Registration failed.' };
      }
    } catch (error: any) {
      return { success: false, error: 'Network error. Please check your connection and try again.' };
    }
  };

  const logout = async () => {
    try {
      // Clear cookie by calling a endpoint or clear client-side and redirect
      // For simplicity, we can delete the cookie via a simple route handler, or client-side cookie clearing
      // In our code, authController sets the cookie. We can set it to expire.
      // Let's call a logout action that clears the cookie in a response
      setUser(null);
      document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
      router.push('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const updateUser = (updatedData: any) => {
    setUser((prev: any) => (prev ? { ...prev, ...updatedData } : null));
  };

  const refreshUser = async () => {
    await fetchSession();
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
