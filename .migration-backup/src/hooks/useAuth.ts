import { useState, useCallback } from 'react';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
}

function loadUser(): User | null {
  try {
    const saved = localStorage.getItem('aviator_user');
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(loadUser);

  const register = useCallback((name: string, email: string, phone: string, password: string): boolean => {
    if (!name || !email || !phone || !password) return false;
    const newUser: User = { id: crypto.randomUUID(), name, email, phone };
    localStorage.setItem('aviator_user', JSON.stringify(newUser));
    localStorage.setItem('aviator_pass', btoa(password)); // Demo only
    setUser(newUser);
    return true;
  }, []);

  const login = useCallback((email: string, password: string): boolean => {
    const saved = loadUser();
    const savedPass = localStorage.getItem('aviator_pass');
    if (saved && saved.email === email && savedPass === btoa(password)) {
      setUser(saved);
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
  }, []);

  return { user, register, login, logout, isAuthenticated: !!user };
}
