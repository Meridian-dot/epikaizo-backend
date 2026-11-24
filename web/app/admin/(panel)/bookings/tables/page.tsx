// web/app/admin/(panel)/bookings/tables/page.tsx  ->  /admin/bookings/tables
"use client";
import { useState } from "react";
import type { BookingStatus } from "@/types/api";
import { decideTableBooking, getTableBookings } from "@/lib/admin-api";
import { useLoad } from "@/lib/use-load";
import Link from "next/link";
import { niceDate, plusDays, todayInWindhoek } from "@/lib/format";
import { useAdmin } from "@/components/admin/AdminContext";
import { BookingActions } from "@/components/admin/BookingActions";
import { Button, Card, ErrorBox, Field, inputClass, Loading, PageTitle, StatusBadge } from "@/components/admin/ui";

export default function TableBookingsPage() {
  const { refreshSummary } = useAdmin();
  const [date, setDate] = useState(todayInWindhoek());
  const [status, setStatus] = useState<"" | BookingStatus>("");
  const [q, setQ] = useState("");
  const list = useLoad(
    () => getTableBookings({ date: date || undefined, status: status || undefined, q: q.trim() || undefined, pageSize: 100 }),
    [date, status, q],
  );

  return (
    <div className="max-w-3xl space-y-4">
      <PageTitle>Table bookings</PageTitle>
      <Card>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Date">
            <div className="flex gap-1">
              <Button variant="secondary" onClick={() => setDate(plusDays(date || todayInWindhoek(), -1))}>‹</Button>
              <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
              <Button variant="secondary" onClick={() => setDate(plusDays(date || todayInWindhoek(), 1))}>›</Button>
            </div>
          </Field>
          <Field label="Show">
            <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as "" | BookingStatus)}>
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="declined">Declined</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </Field>
          <Field label="Search">
            <input className={inputClass} placeholder="Name, phone or reference" value={q} onChange={(e) => setQ(e.target.value)} />
          </Field>
        </div>
        <button className="mt-2 text-sm underline" onClick={() => setDate("")}>Show every date</button>
      </Card>

      {date && <h2 className="text-lg font-bold">{niceDate(date)}</h2>}
      {list.loading && !list.data && <Loading />}
      {list.error && <ErrorBox message={list.error} onRetry={list.reload} />}
      {list.data?.items.length === 0 && <p className="text-stone-600">No table bookings.</p>}

      <ul className="space-y-2">
        {list.data?.items.map((b) => (
          <li key={b.id}>
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-lg font-bold">{b.timeSlot} · {b.partySize} people</p>
                  <p className="font-medium">{b.guestName}</p>
                  <p className="text-sm text-stone-600">{!date && `${niceDate(b.date)} · `}<a className="underline" href={`tel:${b.phone}`}>{b.phone}</a> · {b.reference}</p>
                  {b.notes && <p className="mt-1 whitespace-pre-wrap break-words text-sm">“{b.notes}”</p>}
                </div>
                <StatusBadge status={b.status} />
              </div>
              {b.preOrderReference && (
                <p className="mt-3 rounded-lg bg-stone-50 p-3 text-sm">
                  Has a food pre-order:{" "}
                  <Link className="font-semibold underline" href={`/admin/orders?q=${b.preOrderReference}`}>{b.preOrderReference}</Link>.
                  Declining or cancelling the table also cancels the pre-order.
                </p>
              )}
              <div className="mt-3">
                <BookingActions
                  status={b.status}
                  guestName={b.guestName}
                  decide={(action, message) => decideTableBooking(b.id, action, message)}
                  onDone={() => { list.reload(); refreshSummary(); }}
                />
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
