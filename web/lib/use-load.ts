// web/lib/use-load.ts
// Loads data for a screen and keeps track of "loading", "error" and "reload".
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "./api";

// Turns any error into a sentence a receptionist understands.
export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 403) return "Only a manager can do this.";
    if (e.status === 500) return `Something went wrong on the server (${new Date().toLocaleTimeString()}). Please tell the developer.`;
    return e.message;
  }
  if (e instanceof TypeError) return "Can't reach the server. Check the internet connection and try again.";
  return "Something went wrong. Please try again.";
}

// The first message for each field, e.g. { pricePerNight: "Must be greater than 0" }.
export function fieldErrors(e: unknown): Record<string, string> {
  if (!(e instanceof ApiError) || !e.fields) return {};
  return Object.fromEntries(Object.entries(e.fields).map(([field, messages]) => [field, messages[0]]));
}

// Usage: const rooms = useLoad(getRooms);
//        const booking = useLoad(() => getRoomBooking(id), [id]);   // reloads when id changes
export function useLoad<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);   // bump to load again

  // Always call the newest version of `load`.
  const loadRef = useRef(load);
  useEffect(() => { loadRef.current = load; });

  const key = JSON.stringify(deps);
  useEffect(() => {
    let cancelled = false;
    loadRef.current()
      .then((d) => { if (!cancelled) { setData(d); setError(null); } })
      .catch((e) => { if (!cancelled) setError(errorMessage(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [key, version]);

  const reload = useCallback(() => { setLoading(true); setVersion((v) => v + 1); }, []);

  return { data, error, loading, reload, setData };
}
