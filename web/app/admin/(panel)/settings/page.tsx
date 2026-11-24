// web/app/admin/(panel)/settings/page.tsx  ->  /admin/settings  (manager only)
"use client";
import { useState, type FormEvent, type ReactNode } from "react";
import type { Role, SiteSettings, User } from "@/types/api";
import { createUser, deleteUser, getSettings, getUsers, saveSettings, updateUser } from "@/lib/admin-api";
import { errorMessage, fieldErrors, useLoad } from "@/lib/use-load";
import { useAdmin } from "@/components/admin/AdminContext";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { Button, Card, ErrorBox, Field, inputClass, Loading, PageTitle, SuccessBox } from "@/components/admin/ui";

export default function SettingsPage() {
  const { user } = useAdmin();
  if (user.role !== "manager") return <ErrorBox message="Only a manager can see this page." />;
  return (
    <div className="max-w-3xl space-y-6">
      <PageTitle>Settings</PageTitle>
      <SettingsCard />
      <UsersCard me={user} />
    </div>
  );
}

function SettingsCard() {
  const settings = useLoad(getSettings);
  if (settings.loading) return <Loading />;
  if (settings.error) return <ErrorBox message={settings.error} onRetry={settings.reload} />;
  return <SettingsForm initial={settings.data!} />;
}

// A small helper so each box below is one line.
function Box({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <Field label={label} hint={hint}>{children}</Field>;
}

function SettingsForm({ initial }: { initial: SiteSettings }) {
  const [s, setS] = useState<SiteSettings>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  // Change one value deep inside the settings object, e.g. update("restaurant", "openingTime", "07:00").
  function update<K extends keyof SiteSettings>(group: K, key: string, value: unknown) {
    setSaved(false);
    const current = s[group];
    setS({ ...s, [group]: typeof current === "object" ? { ...current, [key]: value } : value });
  }
  const num = (v: string) => (v === "" ? 0 : Number(v));

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(""); setSaved(false);
    if (s.restaurant.closingTime <= s.restaurant.openingTime) return setError("The restaurant must close after it opens.");
    if (s.restaurant.diningMinutes < 30 || s.restaurant.diningMinutes > 480) return setError("A table sitting must be between 30 and 480 minutes.");
    setBusy(true);
    try {
      setS(await saveSettings(s));               // PUT sends the whole object
      setSaved(true);
    } catch (err) {
      const fe = Object.values(fieldErrors(err));
      setError(fe.length ? fe.join(" ") : errorMessage(err));
    } finally { setBusy(false); }
  }

  const r = s.restaurant;
  const o = s.ordering;
  return (
    <form onSubmit={save} className="space-y-4">
      {error && <ErrorBox message={error} />}
      {saved && <SuccessBox message="Saved. The website will show it within 5 minutes." />}

      <Card>
        <h2 className="mb-3 text-lg font-bold">Contact details</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Box label="Phone"><input className={inputClass} value={s.contact.phone} onChange={(e) => update("contact", "phone", e.target.value)} /></Box>
          <Box label="WhatsApp"><input className={inputClass} value={s.contact.whatsapp} onChange={(e) => update("contact", "whatsapp", e.target.value)} /></Box>
          <Box label="Email"><input className={inputClass} value={s.contact.email} onChange={(e) => update("contact", "email", e.target.value)} /></Box>
          <Box label="Address"><input className={inputClass} value={s.contact.address} onChange={(e) => update("contact", "address", e.target.value)} /></Box>
          <Box label="Instagram link"><input className={inputClass} value={s.links.instagram} onChange={(e) => update("links", "instagram", e.target.value)} /></Box>
          <Box label="Google Maps link"><input className={inputClass} value={s.links.googleMaps} onChange={(e) => update("links", "googleMaps", e.target.value)} /></Box>
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-bold">Rooms</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Box label="Check-in from"><input type="time" className={inputClass} value={s.checkInTime} onChange={(e) => { setSaved(false); setS({ ...s, checkInTime: e.target.value }); }} /></Box>
          <Box label="Check-out by"><input type="time" className={inputClass} value={s.checkOutTime} onChange={(e) => { setSaved(false); setS({ ...s, checkOutTime: e.target.value }); }} /></Box>
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-bold">Restaurant and table bookings</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Box label="Opens"><input type="time" className={inputClass} value={r.openingTime} onChange={(e) => update("restaurant", "openingTime", e.target.value)} /></Box>
          <Box label="Closes"><input type="time" className={inputClass} value={r.closingTime} onChange={(e) => update("restaurant", "closingTime", e.target.value)} /></Box>
          <Box label="Guests can start every…">
            <select className={inputClass} value={r.slotMinutes} onChange={(e) => update("restaurant", "slotMinutes", Number(e.target.value))}>
              <option value={15}>15 minutes</option><option value={30}>30 minutes</option><option value={60}>hour</option>
            </select>
          </Box>
          <Box label="A table is held for (minutes)" hint="300 = 5 hours. Between 30 and 480.">
            <input className={inputClass} inputMode="numeric" value={r.diningMinutes} onChange={(e) => update("restaurant", "diningMinutes", num(e.target.value))} />
          </Box>
          <Box label="Seats"><input className={inputClass} inputMode="numeric" value={r.maxCoversPerSlot} onChange={(e) => update("restaurant", "maxCoversPerSlot", num(e.target.value))} /></Box>
          <Box label="Pre-orders need this much notice (minutes)" hint="180 = 3 hours.">
            <input className={inputClass} inputMode="numeric" value={r.preOrderNoticeMinutes} onChange={(e) => update("restaurant", "preOrderNoticeMinutes", num(e.target.value))} />
          </Box>
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-bold">Food orders</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Box label="Room service from"><input type="time" className={inputClass} value={o.roomService.from} onChange={(e) => update("ordering", "roomService", { ...o.roomService, from: e.target.value })} /></Box>
          <Box label="Room service until"><input type="time" className={inputClass} value={o.roomService.to} onChange={(e) => update("ordering", "roomService", { ...o.roomService, to: e.target.value })} /></Box>
          <Box label="Room service delivery fee (N$)"><input className={inputClass} inputMode="decimal" value={o.roomService.deliveryFee} onChange={(e) => update("ordering", "roomService", { ...o.roomService, deliveryFee: num(e.target.value) })} /></Box>
          <Box label="Food takes about (minutes)"><input className={inputClass} inputMode="numeric" value={o.prepMinutes} onChange={(e) => update("ordering", "prepMinutes", num(e.target.value))} /></Box>
          <Box label="Collection from"><input type="time" className={inputClass} value={o.collection.from} onChange={(e) => update("ordering", "collection", { ...o.collection, from: e.target.value })} /></Box>
          <Box label="Collection until"><input type="time" className={inputClass} value={o.collection.to} onChange={(e) => update("ordering", "collection", { ...o.collection, to: e.target.value })} /></Box>
        </div>
      </Card>

      <Button type="submit" busy={busy}>Save settings</Button>
    </form>
  );
}

function UsersCard({ me }: { me: User }) {
  const users = useLoad(getUsers);
  const [form, setForm] = useState({ name: "", username: "", password: "", role: "staff" as Role });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState<User | null>(null);
  const [resetFor, setResetFor] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState("");

  async function add(e: FormEvent) {
    e.preventDefault();
    const fe: Record<string, string> = {};
    const username = form.username.trim().toLowerCase();
    if (!form.name.trim()) fe.name = "Enter a name.";
    if (!/^[a-z0-9.]{3,30}$/.test(username)) fe.username = "3 to 30 lowercase letters, numbers or dots, e.g. jeanite.";
    if (form.password.length < 10) fe.password = "Use at least 10 characters.";
    setErrors(fe); setError(""); setDone("");
    if (Object.keys(fe).length) return;
    setBusy(true);
    try {
      await createUser({ ...form, name: form.name.trim(), username });
      setForm({ name: "", username: "", password: "", role: "staff" });
      setDone(`Login added for ${username}.`);
      users.reload();
    } catch (err) { setErrors(fieldErrors(err)); setError(errorMessage(err)); } finally { setBusy(false); }
  }

  async function changeRole(u: User, role: Role) {
    try { await updateUser(u.id, { role }); users.reload(); } catch (err) { setError(errorMessage(err)); }
  }

  async function resetPassword(u: User) {
    if (newPassword.length < 10) return setError("The new password needs at least 10 characters.");
    try {
      await updateUser(u.id, { password: newPassword }); // this is the password reset
      setResetFor(null); setNewPassword(""); setError("");
      setDone(`New password saved for ${u.name}. Tell them in person.`);
    } catch (err) { setError(errorMessage(err)); }
  }

  return (
    <Card>
      <h2 className="mb-3 text-lg font-bold">Staff logins</h2>
      {error && <ErrorBox message={error} />}
      {done && <SuccessBox message={done} />}
      {users.loading && <Loading />}
      <ul className="divide-y divide-stone-200">
        {users.data?.map((u) => (
          <li key={u.id} className="space-y-2 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="min-w-40 flex-1">
                <p className="font-medium">{u.name}{u.id === me.id ? " (you)" : ""}</p>
                <p className="text-sm text-stone-600">Username: {u.username}</p>
              </div>
              <select className={`${inputClass} w-auto`} value={u.role} disabled={u.id === me.id} onChange={(e) => changeRole(u, e.target.value as Role)}>
                <option value="staff">Staff</option>
                <option value="manager">Manager</option>
              </select>
              <Button variant="secondary" onClick={() => { setResetFor(resetFor === u.id ? null : u.id); setNewPassword(""); }}>New password</Button>
              {u.id !== me.id && <Button variant="secondary" onClick={() => setToDelete(u)}>Remove</Button>}
            </div>
            {resetFor === u.id && (
              <div className="flex flex-wrap gap-2">
                <input type="password" className={`${inputClass} flex-1`} placeholder="New password (10 characters or more)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                <Button onClick={() => resetPassword(u)}>Save password</Button>
              </div>
            )}
          </li>
        ))}
      </ul>

      <form onSubmit={add} className="mt-4 space-y-3 rounded-lg border border-dashed border-stone-300 p-4">
        <h3 className="font-bold">Add a login</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" error={errors.name}><input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Username" error={errors.username}><input className={inputClass} autoCapitalize="none" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></Field>
          <Field label="Password" error={errors.password} hint="At least 10 characters."><input type="password" className={inputClass} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
          <Field label="Role">
            <select className={inputClass} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
              <option value="staff">Staff</option>
              <option value="manager">Manager</option>
            </select>
          </Field>
        </div>
        <Button type="submit" busy={busy}>Add login</Button>
      </form>

      {toDelete && (
        <ConfirmDialog
          title={`Remove ${toDelete.name}'s login?`}
          text="They won't be able to log in any more."
          confirmLabel="Remove login"
          danger
          onClose={() => setToDelete(null)}
          onConfirm={async () => {
            try { await deleteUser(toDelete.id); users.reload(); } catch (err) { setError(errorMessage(err)); }
            setToDelete(null);
          }}
        />
      )}
    </Card>
  );
}
