// web/lib/api.ts (Docking Spec v1.1, section 3)
import type { ApiErrorBody } from "@/types/api";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string[]>,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const isForm = init.body instanceof FormData; // photo uploads
  const res = await fetch(`/api${path}`, {
    ...init,
    credentials: "include",
    cache: "no-store", // admin data must always be fresh
    headers: isForm ? init.headers : { "Content-Type": "application/json", ...init.headers },
  });

  // Admin session missing or expired: go to login, then come back.
  if (res.status === 401 && path.startsWith("/admin/") && typeof window !== "undefined") {
    window.location.href = `/admin/login?next=${encodeURIComponent(window.location.pathname)}`;
  }

  if (res.status === 204) return undefined as T;
  const body = (await res.json().catch(() => null)) as (T & ApiErrorBody) | null;

  if (!res.ok) {
    throw new ApiError(
      res.status,
      body?.error?.code ?? "server_error",
      body?.error?.message ?? "Something went wrong. Please try again.",
      body?.error?.fields,
    );
  }
  return body as T;
}
