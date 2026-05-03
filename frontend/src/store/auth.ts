import { create } from "zustand";

interface AuthState {
  token: string | null;
  setToken: (token: string) => void;
  clearToken: () => void;
}

const SESSION_KEY = "pt_token";

export const useAuthStore = create<AuthState>()((set) => ({
  token: sessionStorage.getItem(SESSION_KEY),
  setToken: (token) => {
    sessionStorage.setItem(SESSION_KEY, token);
    set({ token });
  },
  clearToken: () => {
    sessionStorage.removeItem(SESSION_KEY);
    set({ token: null });
  },
}));
