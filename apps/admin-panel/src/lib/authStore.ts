import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Admin } from "@tshirt/shared-types";

interface AuthState {
  token: string | null;
  admin: Admin | null;
  login: (token: string, admin: Admin) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      admin: null,
      login: (token, admin) => set({ token, admin }),
      logout: () => set({ token: null, admin: null }),
    }),
    { name: "tshirt-admin-auth" },
  ),
);
