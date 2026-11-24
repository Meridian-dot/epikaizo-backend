// web/components/admin/ui.tsx
// Small building blocks used on every admin screen.
"use client";
import type { ReactNode } from "react";
import type { BookingStatus } from "@/types/api";

export const inputClass =
  "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-base text-stone-900 focus:border-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-200";

type ButtonProps = {
  children: ReactNode; onClick?: () => void; type?: "button" | "submit";
  variant?: "primary" | "secondary" | "danger"; busy?: boolean; disabled?: boolean;
};
export function Button({ children, onClick, type = "button", variant = "primary", busy, disabled }: ButtonProps) {
  const colours = {
    primary: "bg-[#3E160C] text-white hover:bg-[#5a2214]",
    secondary: "bg-white text-stone-800 border border-stone-300 hover:bg-stone-50",
    danger: "bg-red-700 text-white hover:bg-red-800",
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={busy || disabled}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 font-medium disabled:cursor-not-allowed disabled:opacity-50 ${colours}`}
    >
      {busy && <Spinner />}
      {children}
    </button>
  );
}

export function Spinner() {
  return <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />;
}

// A label, the input, an optional hint, and the error message under it.
export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="block font-medium text-stone-800">{label}</span>
      {children}
      {hint && !error && <span className="block text-sm text-stone-500">{hint}</span>}
      {error && <span className="block text-sm font-medium text-red-700">{error}</span>}
    </label>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
      <p>{message}</p>
      {onRetry && <button onClick={onRetry} className="mt-2 font-medium underline">Try again</button>}
    </div>
  );
}

export function SuccessBox({ message }: { message: string }) {
  return <div role="status" className="rounded-lg border border-green-200 bg-green-50 p-3 text-green-800">{message}</div>;
}

// Shown on the first load. The staging API can take up to a minute to wake up.
export function Loading() {
  return (
    <div className="flex items-center gap-3 p-6 text-stone-600">
      <Spinner /> Connecting…
    </div>
  );
}

export function PageTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-bold text-[#3E160C]">{children}</h1>
      {action}
    </div>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">{children}</div>;
}

const badge: Record<BookingStatus, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-amber-100 text-amber-900" },
  confirmed: { label: "Confirmed", className: "bg-green-100 text-green-900" },
  expired: { label: "Expired", className: "bg-stone-200 text-stone-700" },
  declined: { label: "Declined", className: "bg-red-100 text-red-900" },
  cancelled: { label: "Cancelled", className: "bg-red-100 text-red-900" },
};
export function StatusBadge({ status }: { status: BookingStatus }) {
  const b = badge[status];
  return <span className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${b.className}`}>{b.label}</span>;
}

// A yes/no switch, e.g. "Not available today" or "Shown on website".
export function Toggle({ checked, onChange, label, busy }: { checked: boolean; onChange: (v: boolean) => void; label: string; busy?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={busy}
      onClick={() => onChange(!checked)}
      className="inline-flex min-h-11 items-center gap-2 disabled:opacity-50"
    >
      <span className={`relative h-6 w-11 rounded-full transition ${checked ? "bg-green-600" : "bg-stone-300"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${checked ? "left-5" : "left-0.5"}`} />
      </span>
      <span className="text-sm">{label}</span>
    </button>
  );
}
