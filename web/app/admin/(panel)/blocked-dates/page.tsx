// web/app/admin/(panel)/blocked-dates/page.tsx  ->  /admin/blocked-dates
"use client";
import { useState, type FormEvent } from "react";
import type { BlockedDate } from "@/types/api";
import { createBlockedDate, deleteBlockedDate, getBlockedDates, getRooms } from "@/lib/admin-api";
import { errorMessage, fieldErrors, useLoad } from "@/lib/use-load";
import { blockedLabel, plusDays, todayInWindhoek } from "@/lib/format";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { Button, Card, ErrorBox, Field, inputClass, Loading, PageTitle, SuccessBox } from "@/components/admin/ui";

export default function BlockedDatesPage() {
  const rooms = useLoad(getRooms);
  const blocks = useLoad(() => getBlockedDates({ from: todayInWindhoek() }));
  const [form, setForm] = useState({ roomTypeId: "", firstNight: "", lastNight: "", units: "1", reason: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState<BlockedDate | null>(null);

  const room = rooms.data?.find((r) => String(r.id) === form.roomTypeId);

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    const e: Record<string, string> = {};
    if (!form.roomTypeId) e.roomTypeId = "Choose a room type.";
    if (!form.firstNight) e.startDate = "Choose the first night.";
    if (!form.lastNight) e.endDate = "Choose the last night.";
    if (form.firstNight && form.lastNight && form.lastNight < form.firstNight) e.endDate = "The last night can't be before the first night.";
    const units = Number(form.units);
    if (!Number.isInteger(units) || units < 1) e.units = "Enter a whole number, 1 or more.";
    else if (room && units > room.totalUnits) e.units = `${room.name} only has ${room.totalUnits} rooms.`;
    setErrors(e); setError(""); setDone("");
    if (Object.keys(e).length) return;

    setBusy(true);
    try {
      // endDate is EXCLUSIVE: the first night that is free again = last blocked night + 1 day.
      const created = await createBlockedDate({
        roomTypeId: Number(form.roomTypeId), startDate: form.firstNight, endDate: plusDays(form.lastNight, 1),
        units, reason: form.reason.trim(),
      });
      setDone(`${blockedLabel(created.startDate, created.endDate)} for ${created.units} × ${created.roomTypeName}.`);
      setForm({ ...form, firstNight: "", lastNight: "", reason: "" });
      blocks.reload();
    } catch (err) {
      setErrors(fieldErrors(err));
      setError(errorMessage(err));          // 409 unavailable names the busiest night
    } finally { setBusy(false); }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <PageTitle>Blocked dates</PageTitle>
      <p className="text-stone-600">Take rooms out of use, for example for painting or repairs. Guests can&apos;t book them on those nights.</p>

      <Card>
        <form onSubmit={submit} className="space-y-4">
          <h2 className="text-lg font-bold">Block rooms</h2>
          {error && <ErrorBox message={error} />}
          {done && <SuccessBox message={done} />}
          {rooms.loading && <Loading />}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Room type" error={errors.roomTypeId}>
              <select className={inputClass} value={form.roomTypeId} onChange={(e) => setForm({ ...form, roomTypeId: e.target.value })}>
                <option value="">Choose…</option>
                {rooms.data?.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.totalUnits} rooms)</option>)}
              </select>
            </Field>
            <Field label="How many rooms" error={errors.units}>
              <input className={inputClass} inputMode="numeric" value={form.units} onChange={(e) => setForm({ ...form, units: e.target.value })} />
            </Field>
            <Field label="First night blocked" error={errors.startDate}>
              <input type="date" className={inputClass} value={form.firstNight} onChange={(e) => setForm({ ...form, firstNight: e.target.value })} />
            </Field>
            <Field label="Last night blocked" error={errors.endDate}
              hint={form.lastNight ? `Free again on the night of ${plusDays(form.lastNight, 1)}` : undefined}>
              <input type="date" className={inputClass} value={form.lastNight} min={form.firstNight || undefined} onChange={(e) => setForm({ ...form, lastNight: e.target.value })} />
            </Field>
          </div>
          <Field label="Reason (staff only)" error={errors.reason}>
            <input className={inputClass} placeholder="For example: Painting" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </Field>
          <Button type="submit" busy={busy}>Block these nights</Button>
        </form>
      </Card>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">Coming up</h2>
        {blocks.loading && <Loading />}
        {blocks.error && <ErrorBox message={blocks.error} onRetry={blocks.reload} />}
        {blocks.data?.length === 0 && <p className="text-stone-600">No rooms are blocked.</p>}
        <ul className="space-y-2">
          {blocks.data?.map((b) => (
            <li key={b.id}>
              <Card>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">{blockedLabel(b.startDate, b.endDate)}</p>
                    <p className="text-sm text-stone-600">{b.units} × {b.roomTypeName}{b.reason ? ` · ${b.reason}` : ""}</p>
                  </div>
                  <Button variant="secondary" onClick={() => setToDelete(b)}>Free these rooms</Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      {toDelete && (
        <ConfirmDialog
          title="Free these rooms again?"
          text={`${toDelete.units} × ${toDelete.roomTypeName}, ${blockedLabel(toDelete.startDate, toDelete.endDate)}. Guests will be able to book them.`}
          confirmLabel="Yes, free them"
          onClose={() => setToDelete(null)}
          onConfirm={async () => {
            try { await deleteBlockedDate(toDelete.id); blocks.reload(); } catch (e) { setError(errorMessage(e)); }
            setToDelete(null);
          }}
        />
      )}
    </div>
  );
}
