"use client";

import { create } from "zustand";
import { api } from "./api-client";

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  initialized: boolean;
  fetchUser: () => Promise<AuthUser | null>;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (email: string, password: string, name?: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: false,
  initialized: false,

  fetchUser: async () => {
    try {
      const res = await api.get<{ user: AuthUser }>("/api/auth/me");
      set({ user: res.user, initialized: true });
      return res.user;
    } catch {
      set({ user: null, initialized: true });
      return null;
    }
  },

  login: async (email, password) => {
    set({ loading: true });
    try {
      const res = await api.post<{ user: AuthUser }>("/api/auth/login", {
        email,
        password,
      });
      set({ user: res.user, initialized: true });
      return res.user;
    } finally {
      set({ loading: false });
    }
  },

  register: async (email, password, name) => {
    set({ loading: true });
    try {
      const res = await api.post<{ user: AuthUser }>("/api/auth/register", {
        email,
        password,
        name,
      });
      set({ user: res.user, initialized: true });
      return res.user;
    } finally {
      set({ loading: false });
    }
  },

  logout: async () => {
    await api.post("/api/auth/logout");
    set({ user: null });
  },
}));
