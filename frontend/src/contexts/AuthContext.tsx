import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '../shared/lib/api';
import { connectSocket, disconnectSocket } from '../shared/lib/socket';

export type Role = 'EXECUTIVE' | 'MANAGER' | 'OPERATOR';

export interface AuthUser {
  id: string;
  name: string;
  role: Role;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (identifier: string, credential: string) => Promise<AuthUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = 'mes_token';
const USER_KEY = 'mes_user';

function loadStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(loadStoredUser);

  // The cleanup's condition is inverted from what it looks like it should
  // be: `user` here is the value captured when *this* effect ran, so
  // `!user` is only true for a run that never called connectSocket() in
  // the first place — the run that logs in (user goes truthy) never
  // triggers this cleanup's disconnectSocket() when logging back out. In
  // practice this doesn't cause a stuck connection only because logout()
  // below calls disconnectSocket() directly; this effect's cleanup isn't
  // actually what's tearing the connection down.
  useEffect(() => {
    if (user) connectSocket();
    return () => {
      if (!user) disconnectSocket();
    };
  }, [user]);

  const login = async (identifier: string, credential: string): Promise<AuthUser> => {
    const { data } = await api.post('/auth/login', { identifier, credential });
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    setUser(data.user);
    connectSocket();
    return data.user as AuthUser;
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
    disconnectSocket();
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
