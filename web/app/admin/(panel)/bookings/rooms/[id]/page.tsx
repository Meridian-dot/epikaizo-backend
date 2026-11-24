// web/app/admin/(panel)/bookings/rooms/[id]/page.tsx  ->  /admin/bookings/rooms/12
"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { decideRoomBooking, getRoomBooking } from "@/lib/admin-api";
import { useLoad } from "@/lib/use-load";
import { money, niceDate, windhoekTime } from "@/lib/format";
import { useAdmin } from "@/components/admin/AdminContext";
import { BookingActions } from "@/components/admin/BookingActions";
import { Card, ErrorBox, Loading, PageTitle, StatusBadge } from "@/components/admin/ui";

export default function RoomBookingDetail() {
  const { id } = useParams<{ id: string }>();
  const { refreshSummary } = useAdmin();
  const booking = useLoad(() => getRoomBooking(Number(id)), [id]);

  if (booking.loading && !booking.data) return <Loading />;
  if (booking.error && !booking.data)
    return <div className="space-y-3"><ErrorBox message={booking.error} /><Link href="/admin/bookings/rooms" className="underline">← Back to the list</Link></div>;
  const b = booking.data!;

  const rows: [string, string][] = [
    ["Reference", b.reference],
    ["Room", b.roomType.name],
    ["Bed setup", b.setup.name],
    ["Arrives", niceDate(b.checkIn)],
    ["Leaves", niceDate(b.checkOut)],
    ["Nights", String(b.nights)],
    ["Guests", String(b.guests)],
    // Totals always come from the API, never calculated here.
    ["Price", `${money(b.pricePerNight)} per night, ${money(b.totalPrice)} in total (paid on arrival)`],
    ["Phone", b.phone],
    ["Email", b.email],
    ["Requested", windhoekTime(b.createdAt)],
    ...(b.decidedAt ? [["Answered", `${windhoekTime(b.decidedAt)} by ${b.decidedBy?.name ?? "someone"}`] as [string, string]] : []),
  ];

  return (
    <div className="max-w-2xl space-y-4">
      <Link href="/admin/bookings/rooms" className="text-sm underline">← All room bookings</Link>
      <PageTitle action={<StatusBadge status={b.status} />}>{b.guestName}</PageTitle>

      {b.status === "pending" && b.expiresAt && (
        <p className="rounded-lg bg-amber-50 p-3 text-amber-900">Holds the room until {windhoekTime(b.expiresAt)}</p>
      )}
      {b.status !== "declined" && b.status !== "cancelled" && (
        <p className="rounded-lg bg-stone-200 p-3 font-medium">Set up the room as: {b.setup.name}. Staff need 2 hours to change beds.</p>
      )}

      <Card>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-stone-500">{k}</dt>
              <dd className="font-medium">{k === "Phone" ? <a href={`tel:${v}`} className="underline">{v}</a> : k === "Email" ? <a href={`mailto:${v}`} className="underline">{v}</a> : v}</dd>
            </div>
          ))}
        </dl>
        {b.notes && (
          <div className="mt-4">
            <p className="text-stone-500">Guest&apos;s note</p>
            <p className="whitespace-pre-wrap break-words">{b.notes}</p>
          </div>
        )}
      </Card>

      {booking.error && <ErrorBox message={booking.error} />}
      <BookingActions
        status={b.status}
        guestName={b.guestName}
        decide={(action, message) => decideRoomBooking(b.id, action, message)}
        onDone={() => { booking.reload(); refreshSummary(); }}
      />
    </div>
  );
}
