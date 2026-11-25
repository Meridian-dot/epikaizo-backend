// web/app/admin/login/page.tsx  ->  /admin/login
"use client";
import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { login } from "@/lib/admin-api";
import { ApiError } from "@/lib/api";
import { errorMessage } from "@/lib/use-load";
import { Button, ErrorBox, Field, inputClass } from "@/components/admin/ui";

function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();                       // stop the browser reloading the page
    setError("");
    setBusy(true);
    try {
      await login(username, password);
      // Only follow "next" if it points inside the admin area.
      router.replace(next && next.startsWith("/admin") ? next : "/admin");
    } catch (err) {
      if (err instanceof ApiError && err.code === "invalid_credentials") setError("Wrong username or password.");
      else setError(errorMessage(err));        // includes 429 too_many_attempts
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-xl bg-white p-6 shadow">
      <h1 className="text-2xl font-bold text-[#3E160C]">Epikaizo staff login</h1>
      {error && <ErrorBox message={error} />}
      <Field label="Username">
        <input className={inputClass} autoComplete="username" autoCapitalize="none" required value={username} onChange={(e) => setUsername(e.target.value)} />
      </Field>
      <Field label="Password">
        <input className={inputClass} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <Button type="submit" busy={busy}>Log in</Button>
      {process.env.NEXT_PUBLIC_USE_MOCKS === "true" && (
        <p className="text-sm text-stone-500">Practice mode: username tina (manager) or jeanite (staff), password password123.</p>
      )}
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-100 p-4">
      {/* useSearchParams needs a Suspense wrapper in Next.js */}
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
