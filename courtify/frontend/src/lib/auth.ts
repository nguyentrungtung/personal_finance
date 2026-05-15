import { createContext, useContext, useState, useCallback, type ReactNode, createElement } from 'react';
import { api, ApiError } from './api';
import type { UserProfile } from '@courtify/types';

interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<{ requireTotp: boolean }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  const refreshUser = useCallback(async () => {
    try {
      const envelope = await api.get<{ data: UserProfile }>('/api/v1/auth/me');
      setState({ user: envelope.data, isAuthenticated: true, isLoading: false });
    } catch {
      setState({ user: null, isAuthenticated: false, isLoading: false });
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const envelope = await api.post<{
      data: { authenticated: boolean; requires_totp: boolean; totp_token?: string };
    }>('/api/v1/auth/login', { email, password });

    const data = envelope.data;

    if (data.requires_totp) {
      return { requireTotp: true };
    }

    // Cookies are set by the server; fetch the user profile to populate state
    if (data.authenticated) {
      try {
        const meEnvelope = await api.get<{ data: UserProfile }>('/api/v1/auth/me');
        setState({ user: meEnvelope.data, isAuthenticated: true, isLoading: false });
      } catch {
        setState({ user: null, isAuthenticated: true, isLoading: false });
      }
    }

    return { requireTotp: false };
  }, []);

  const logout = useCallback(async () => {
    await api.post('/api/v1/auth/logout');
    setState({ user: null, isAuthenticated: false, isLoading: false });
  }, []);

  return createElement(
    AuthContext.Provider,
    { value: { ...state, login, logout, refreshUser } },
    children
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

/** Re-export ApiError for consumers */
export { ApiError };
