// web/app/admin/(panel)/bookings/rooms/page.tsx  ->  /admin/bookings/rooms
"use client";
import { useState } from "react";
import Link from "next/link";
import type { BookingStatus } from "@/types/api";
import { getRoomBookings, type RoomBookingFilters } from "@/lib/admin-api";
import { useLoad } from "@/lib/use-load";
import { niceDate, windhoekTime } from "@/lib/format";
import { Button, Card, ErrorBox, Field, inputClass, Loading, PageTitle, StatusBadge } from "@/components/admin/ui";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "pending,expired", label: "Waiting for an answer" },
  { value: "", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "expired", label: "Expired" },
  { value: "declined", label: "Declined" },
  { value: "cancelled", label: "Cancelled" },
];
const PAGE_SIZE = 20;

export default function RoomBookingsPage() {
  const [status, setStatus] = useState("pending,expired");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"createdAt" | "checkIn">("createdAt");
  const [page, setPage] = useState(1);

  const filters: RoomBookingFilters = {
    status: status ? (status.split(",") as BookingStatus[]) : undefined,
    from: from || undefined, to: to || undefined, q: q.trim() || undefined, sort, page, pageSize: PAGE_SIZE,
  };
  const list = useLoad(() => getRoomBookings(filters), [JSON.stringify(filters)]);
  const lastPage = list.data ? Math.max(1, Math.ceil(list.data.total / PAGE_SIZE)) : 1;

  // Changing a filter goes back to page 1.
  const change = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setPage(1); };

  return (
    <div className="space-y-4">
      <PageTitle>Room bookings</PageTitle>

      <Card>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Show">
            <select className={inputClass} value={status} onChange={(e) => change(setStatus)(e.target.value)}>
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="Staying from">
            <input type="date" className={inputClass} value={from} onChange={(e) => change(setFrom)(e.target.value)} />
          </Field>
          <Field label="Staying until">
            <input type="date" className={inputClass} value={to} onChange={(e) => change(setTo)(e.target.value)} />
          </Field>
          <Field label="Search">
            <input className={inputClass} placeholder="Name, phone, email or reference" value={q} onChange={(e) => change(setQ)(e.target.value)} />
          </Field>
          <Field label="Order">
            <select className={inputClass} value={sort} onChange={(e) => change(setSort)(e.target.value as "createdAt" | "checkIn")}>
              <option value="createdAt">Newest requests first</option>
              <option value="checkIn">Soonest arrival first</option>
            </select>
          </Field>
        </div>
      </Card>

      {list.loading && !list.data && <Loading />}
      {list.error && <ErrorBox message={list.error} onRetry={list.reload} />}
      {list.data && list.data.items.length === 0 && <p className="text-stone-600">No bookings match.</p>}

      {/* Cards, not a wide table, so it works on a 375 px phone. */}
      <ul className="space-y-2">
        {list.data?.items.map((b) => (
          <li key={b.id}>
            <Link href={`/admin/bookings/rooms/${b.id}`} className="block">
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{b.guestName}</p>
                    <p className="text-sm text-stone-600">{b.roomType.name}, {b.setup.name} · {b.guests} guest{b.guests === 1 ? "" : "s"}</p>
                    <p className="text-sm text-stone-600">{niceDate(b.checkIn)} to {niceDate(b.checkOut)} · {b.nights} night{b.nights === 1 ? "" : "s"}</p>
                    <p className="text-xs text-stone-500">{b.reference}</p>
                  </div>
                  <div className="text-right">
                    <StatusBadge status={b.status} />
                    {b.status === "pending" && b.expiresAt && <p className="mt-1 text-sm text-amber-800">Answer by {windhoekTime(b.expiresAt)}</p>}
                  </div>
                </div>
              </Card>
            </Link>
          </li>
        ))}
      </ul>

      {list.data && list.data.total > PAGE_SIZE && (
        <div className="flex items-center gap-3">
          <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
          <span>Page {page} of {lastPage}</span>
          <Button variant="secondary" disabled={page >= lastPage} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}
