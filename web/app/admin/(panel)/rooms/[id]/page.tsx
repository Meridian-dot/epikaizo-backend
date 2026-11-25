// web/app/admin/(panel)/rooms/[id]/page.tsx  ->  /admin/rooms/new  and  /admin/rooms/3
"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { AdminRoom, AdminSetup, Amenity } from "@/types/api";
import { createAmenity, createRoom, createSetup, getAmenities, getRoom, updateRoom, updateSetup, type RoomInput } from "@/lib/admin-api";
import { errorMessage, fieldErrors, useLoad } from "@/lib/use-load";
import { money } from "@/lib/format";
import { ApiError } from "@/lib/api";
import { PhotoManager } from "@/components/admin/PhotoManager";
import { Button, Card, ErrorBox, Field, inputClass, Loading, PageTitle, SuccessBox, Toggle } from "@/components/admin/ui";

export default function RoomEditPage() {
  const params = useParams<{ id: string }>();
  const isNew = params.id === "new";
  const room = useLoad(() => (isNew ? Promise.resolve(null) : getRoom(Number(params.id))), [params.id]);
  const amenities = useLoad(getAmenities);

  if (room.loading && !room.data) return <Loading />;
  if (amenities.loading && !amenities.data) return <Loading />;
  if (room.error) return <ErrorBox message={room.error} onRetry={room.reload} />;
  if (amenities.error) return <ErrorBox message={amenities.error} onRetry={amenities.reload} />;

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/admin/rooms" className="text-sm underline">← All rooms</Link>
      <PageTitle>{isNew ? "Add a room type" : room.data!.name}</PageTitle>
      <RoomForm room={room.data} amenities={amenities.data ?? []} onAmenitiesChanged={amenities.reload} onSaved={room.reload} />
      {!isNew && room.data && (
        <>
          <SetupsCard room={room.data} onChanged={room.reload} />
          <Card>
            <h2 className="mb-3 text-lg font-bold">Photos</h2>
            <p className="mb-3 text-sm text-stone-600">The first photo is the main one. Drag, or use the arrows, to change the order.</p>
            <PhotoManager photos={room.data.photos} target={{ roomTypeId: room.data.id }} onChanged={room.reload} />
          </Card>
        </>
      )}
    </div>
  );
}

function RoomForm({ room, amenities, onAmenitiesChanged, onSaved }: {
  room: AdminRoom | null; amenities: Amenity[]; onAmenitiesChanged: () => void; onSaved: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: room?.name ?? "",
    description: room?.description ?? "",
    totalUnits: room ? String(room.totalUnits) : "1",
    isActive: room?.isActive ?? true,
    amenityIds: room?.amenityIds ?? [],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [newAmenity, setNewAmenity] = useState("");

  const set = (key: keyof typeof form, value: unknown) => { setForm({ ...form, [key]: value }); setSaved(false); };

  async function submit(ev: FormEvent) {
    ev.preventDefault();                       // stop the browser reloading the page
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Please give the room type a name.";
    if (!(Number.isInteger(Number(form.totalUnits)) && Number(form.totalUnits) >= 1)) e.totalUnits = "Enter a whole number, 1 or more.";
    setErrors(e);
    setError("");
    if (Object.keys(e).length) return;
    const body: RoomInput = {
      name: form.name.trim(), description: form.description.trim(),
      totalUnits: Number(form.totalUnits),       // send a number, not text
      isActive: form.isActive, amenityIds: form.amenityIds, // the full list, every time
    };
    setBusy(true);
    try {
      if (room) { await updateRoom(room.id, body); setSaved(true); onSaved(); }
      else { const created = await createRoom(body); router.replace(`/admin/rooms/${created.id}`); }
    } catch (err) {
      setErrors(fieldErrors(err));
      setError(errorMessage(err));
      if (err instanceof ApiError && err.status === 404) router.replace("/admin/rooms");
    } finally {
      setBusy(false);
    }
  }

  async function addAmenity() {
    if (!newAmenity.trim()) return;
    try {
      const a = await createAmenity(newAmenity.trim());
      setNewAmenity("");
      set("amenityIds", [...form.amenityIds, a.id]);
      onAmenitiesChanged();
    } catch (err) {
      setError(fieldErrors(err).name ?? errorMessage(err));
    }
  }

  const toggleAmenity = (aid: number) =>
    set("amenityIds", form.amenityIds.includes(aid) ? form.amenityIds.filter((x) => x !== aid) : [...form.amenityIds, aid]);

  return (
    <form onSubmit={submit} className="space-y-4">
      <Card>
        <div className="space-y-4">
          {error && <ErrorBox message={error} />}
          {saved && <SuccessBox message="Saved. The website will show it within 5 minutes." />}
          <Field label="Room type name" error={errors.name} hint='Use the same name as the website, for example "Type III".'>
            <input className={inputClass} value={form.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field label="Description" error={errors.description}>
            <textarea className={inputClass} rows={4} value={form.description} onChange={(e) => set("description", e.target.value)} />
          </Field>
          <Field label="How many rooms of this type" error={errors.totalUnits} hint="All the setups below share these rooms.">
            <input className={inputClass} inputMode="numeric" value={form.totalUnits} onChange={(e) => set("totalUnits", e.target.value)} />
          </Field>
          <Toggle checked={form.isActive} onChange={(v) => set("isActive", v)} label={form.isActive ? "Shown on the website" : "Hidden from the website"} />
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-bold">What the room has</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {amenities.map((a) => (
            <label key={a.id} className="flex min-h-11 items-center gap-2">
              <input type="checkbox" className="h-5 w-5" checked={form.amenityIds.includes(a.id)} onChange={() => toggleAmenity(a.id)} />
              {a.name}
            </label>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input className={inputClass} placeholder="Add something new, e.g. Desk" value={newAmenity} onChange={(e) => setNewAmenity(e.target.value)} />
          <Button variant="secondary" onClick={addAmenity}>Add</Button>
        </div>
      </Card>

      <Button type="submit" busy={busy}>{room ? "Save changes" : "Create room type"}</Button>
    </form>
  );
}

// Setups and prices: this is where the owner sets prices (spec v1.1).
function SetupsCard({ room, onChanged }: { room: AdminRoom; onChanged: () => void }) {
  const [editing, setEditing] = useState<AdminSetup | "new" | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const setups = [...room.setups].sort((a, b) => a.sortOrder - b.sortOrder);

  async function change(s: AdminSetup, changes: Partial<AdminSetup>) {
    setBusyId(s.id);
    setError("");
    try { await updateSetup(s.id, changes); onChanged(); } catch (e) { setError(errorMessage(e)); } finally { setBusyId(null); }
  }

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">Setups and prices</h2>
        <Button variant="secondary" onClick={() => setEditing("new")}>Add a setup</Button>
      </div>
      <p className="mb-3 text-sm text-stone-600">
        A setup is how the beds are arranged, e.g. Single, Twin or Double. Each has its own price. A price change only affects new bookings.
      </p>
      {error && <ErrorBox message={error} />}
      {setups.length === 0 && <p className="text-amber-800">No setups yet, so guests can&apos;t book this room type.</p>}
      <ul className="divide-y divide-stone-200">
        {setups.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-3 py-3">
            <div className="min-w-40 flex-1">
              <p className={`font-medium ${s.isActive ? "" : "text-stone-400 line-through"}`}>{s.name}</p>
              <p className="text-sm text-stone-600">Up to {s.maxGuests} guest{s.maxGuests === 1 ? "" : "s"} · {money(s.pricePerNight)} per night{s.onRequest ? " · on request" : ""}</p>
            </div>
            <Toggle checked={s.isActive} busy={busyId === s.id} onChange={(v) => change(s, { isActive: v })} label={s.isActive ? "Offered" : "Hidden"} />
            <Button variant="secondary" onClick={() => setEditing(s)}>Edit</Button>
          </li>
        ))}
      </ul>
      {editing && (
        <SetupForm roomId={room.id} setup={editing === "new" ? null : editing} nextSort={setups.length + 1}
          onClose={() => setEditing(null)} onSaved={() => { setEditing(null); onChanged(); }} />
      )}
    </Card>
  );
}

function SetupForm({ roomId, setup, nextSort, onClose, onSaved }: {
  roomId: number; setup: AdminSetup | null; nextSort: number; onClose: () => void; onSaved: () => void;
}) {
  const [name, setName] = useState(setup?.name ?? "");
  const [guests, setGuests] = useState(String(setup?.maxGuests ?? 2));
  const [price, setPrice] = useState(setup ? String(setup.pricePerNight) : "");
  const [onRequest, setOnRequest] = useState(setup?.onRequest ?? false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Give the setup a name, e.g. Double.";
    if (!(Number.isInteger(Number(guests)) && Number(guests) >= 1)) e.maxGuests = "Enter a whole number, 1 or more.";
    if (!(Number(price) > 0)) e.pricePerNight = "Enter a price greater than 0.";
    setErrors(e);
    if (Object.keys(e).length) return;
    const body = { name: name.trim(), maxGuests: Number(guests), pricePerNight: Number(price), onRequest };
    setBusy(true);
    try {
      if (setup) await updateSetup(setup.id, body);
      else await createSetup(roomId, { ...body, sortOrder: nextSort });
      onSaved();
    } catch (err) { setErrors(fieldErrors(err)); setError(errorMessage(err)); } finally { setBusy(false); }
  }

  return (
    <div className="mt-4 space-y-3 rounded-lg border border-dashed border-stone-300 p-4">
      <h3 className="font-bold">{setup ? `Edit ${setup.name}` : "New setup"}</h3>
      {error && <ErrorBox message={error} />}
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Name" error={errors.name}><input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Most guests" error={errors.maxGuests}><input className={inputClass} inputMode="numeric" value={guests} onChange={(e) => setGuests(e.target.value)} /></Field>
        <Field label="Price per night (N$)" error={errors.pricePerNight}><input className={inputClass} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
      </div>
      <Toggle checked={onRequest} onChange={setOnRequest} label='Show as "Available on request"' />
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onClose}>Close</Button>
        <Button onClick={save} busy={busy}>Save setup</Button>
      </div>
    </div>
  );
}
