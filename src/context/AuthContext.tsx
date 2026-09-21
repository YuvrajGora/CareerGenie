'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export const ROLE_STORAGE_KEY = 'cg_active_role';
export const ROLE_HEADER_NAME = 'x-careergenie-role';

// Install interceptor in client environment once to automatically provide active role context
if (typeof window !== 'undefined' && !(window as any).__cg_fetch_interceptor_installed) {
  (window as any).__cg_fetch_interceptor_installed = true;
  const originalFetch = window.fetch;

  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    try {
      let isRelativeApi = false;

      if (typeof input === 'string') {
        isRelativeApi = input.startsWith('/api/') || input === '/api';
      } else if (input instanceof URL) {
        isRelativeApi = input.origin === window.location.origin && input.pathname.startsWith('/api');
      } else if (typeof Request !== 'undefined' && input instanceof Request) {
        const url = new URL(input.url, window.location.origin);
        isRelativeApi = url.origin === window.location.origin && url.pathname.startsWith('/api');
      }

      if (isRelativeApi) {
        const activeRole = sessionStorage.getItem(ROLE_STORAGE_KEY);
        if (activeRole) {
          let hasRoleHeader = false;

          if (init?.headers) {
            if (init.headers instanceof Headers) {
              hasRoleHeader = init.headers.has(ROLE_HEADER_NAME);
            } else if (Array.isArray(init.headers)) {
              hasRoleHeader = init.headers.some(([k]) => k.toLowerCase() === ROLE_HEADER_NAME);
            } else {
              hasRoleHeader = Object.keys(init.headers).some((k) => k.toLowerCase() === ROLE_HEADER_NAME);
            }
          } else if (typeof Request !== 'undefined' && input instanceof Request) {
            hasRoleHeader = input.headers.has(ROLE_HEADER_NAME);
          }

          if (!hasRoleHeader) {
            const newHeaders = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
            newHeaders.set(ROLE_HEADER_NAME, activeRole);
            init = { ...init, headers: newHeaders };
          }
        }
      }
    } catch (e) {
      // Proceed safely if URL parsing encounters non-standard formats
    }

    return originalFetch.call(this, input, init);
  };
}

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

  const fetchSession = async (roleOverride?: string | null) => {
    try {
      const activeRole = roleOverride !== undefined
        ? roleOverride
        : (typeof window !== 'undefined' ? sessionStorage.getItem(ROLE_STORAGE_KEY) : null);

      const headers: Record<string, string> = {};
      if (activeRole) {
        headers[ROLE_HEADER_NAME] = activeRole;
      }

      const response = await fetch('/api/auth/me', {
        headers,
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        if (typeof window !== 'undefined' && data.user?.role) {
          sessionStorage.setItem(ROLE_STORAGE_KEY, data.user.role);
        }
      } else {
        setUser(null);
        if (typeof window !== 'undefined' && activeRole) {
          sessionStorage.removeItem(ROLE_STORAGE_KEY);
        }
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
        if (typeof window !== 'undefined' && data.user?.role) {
          sessionStorage.setItem(ROLE_STORAGE_KEY, data.user.role);
        }
        router.push('/dashboard');
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
        if (typeof window !== 'undefined' && data.user?.role) {
          sessionStorage.setItem(ROLE_STORAGE_KEY, data.user.role);
        }
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
      const activeRole = typeof window !== 'undefined' ? sessionStorage.getItem(ROLE_STORAGE_KEY) : null;

      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(activeRole ? { [ROLE_HEADER_NAME]: activeRole } : {}),
        },
        body: JSON.stringify({ role: activeRole }),
      });

      setUser(null);
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(ROLE_STORAGE_KEY);
      }
      router.push('/');
    } catch (error) {
      console.error('Logout error:', error);
      setUser(null);
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(ROLE_STORAGE_KEY);
      }
      router.push('/');
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
