import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "../types";

interface AppStore {
  currentUser: User | null;
  login: (user: User) => void;
  logout: () => void;
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      currentUser: null,
      login: (user) => set({ currentUser: user }),
      logout: () => set({ currentUser: null }),
    }),
    {
      name: "notes-auth",
      partialize: (s) => ({ currentUser: s.currentUser }),
    }
  )
);
