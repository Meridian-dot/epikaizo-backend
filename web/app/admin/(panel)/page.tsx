// web/app/admin/(panel)/rooms/page.tsx  ->  /admin/rooms
"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import type { AdminRoom } from "@/types/api";
import { getRooms } from "@/lib/admin-api";
import { useLoad } from "@/lib/use-load";
import { money } from "@/lib/format";
import { Card, ErrorBox, Loading, PageTitle } from "@/components/admin/ui";

// The cheapest active setup, like the website's "From N$ 440 per night".
function fromPrice(r: AdminRoom): number | null {
  const prices = r.setups.filter((s) => s.isActive).map((s) => s.pricePerNight);
  return prices.length ? Math.min(...prices) : null;
}

export default function RoomsPage() {
  const { data: rooms, error, loading, reload } = useLoad(getRooms);
  const totalRooms = rooms?.filter((r) => r.isActive).reduce((sum, r) => sum + r.totalUnits, 0) ?? 0;

  return (
    <div>
      <PageTitle action={<Link href="/admin/rooms/new" className="rounded-lg bg-[#3E160C] px-4 py-2 font-medium text-white">Add a room type</Link>}>
        Rooms
      </PageTitle>
      {loading && <Loading />}
      {error && <ErrorBox message={error} onRetry={reload} />}
      {rooms && <p className="mb-4 text-stone-600">{totalRooms} rooms shown on the website.</p>}
      <ul className="grid gap-3 md:grid-cols-2">
        {rooms?.map((r) => (
          <li key={r.id}>
            <Link href={`/admin/rooms/${r.id}`} className="block">
              <Card>
                <div className="flex gap-3">
                  {r.photos[0]
                    ? <img src={r.photos[0].url} alt={r.photos[0].alt} className="h-20 w-28 rounded object-cover" />
                    : <div className="flex h-20 w-28 items-center justify-center rounded bg-stone-100 text-xs text-stone-500">No photo yet</div>}
                  <div>
                    <p className="font-semibold">{r.name}</p>
                    <p className="text-sm text-stone-600">{r.totalUnits} room{r.totalUnits === 1 ? "" : "s"} · {r.setups.filter((s) => s.isActive).length} setups</p>
                    <p className="text-sm text-stone-600">{fromPrice(r) === null ? "No price yet: add a setup" : `From ${money(fromPrice(r)!)} per night`}</p>
                    {!r.isActive && <p className="mt-1 inline-block rounded bg-stone-200 px-2 text-sm">Hidden from the website</p>}
                  </div>
                </div>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
