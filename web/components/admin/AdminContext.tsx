// web/components/admin/AdminContext.tsx
// Shares the logged-in user and the sidebar counts with every admin screen.
"use client";
import { createContext, useContext } from "react";
import type { Summary, User } from "@/types/api";

export type AdminState = { user: User; summary: Summary | null; refreshSummary: () => void };
export const AdminContext = createContext<AdminState | null>(null);

export function useAdmin(): AdminState {
  const value = useContext(AdminContext);
  if (!value) throw new Error("useAdmin must be used inside the admin layout");
  return value;
}
