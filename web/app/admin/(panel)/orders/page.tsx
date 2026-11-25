// web/app/admin/(panel)/orders/page.tsx  ->  /admin/orders  (kitchen and reception)
"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Order, OrderStatus, OrderType } from "@/types/api";
import { getOrders, nextOrderSteps, setOrderStatus } from "@/lib/admin-api";
import { errorMessage, useLoad } from "@/lib/use-load";
import { money, windhoekTime } from "@/lib/format";
import { useAdmin } from "@/components/admin/AdminContext";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { Button, Card, ErrorBox, Field, inputClass, Loading, PageTitle } from "@/components/admin/ui";

const BADGE: Record<OrderStatus, { label: string; className: string }> = {
  received: { label: "New", className: "bg-red-100 text-red-900" },
  accepted: { label: "Preparing", className: "bg-amber-100 text-amber-900" },
  out_for_delivery: { label: "On its way", className: "bg-blue-100 text-blue-900" },
  ready: { label: "Ready", className: "bg-blue-100 text-blue-900" },
  completed: { label: "Done", className: "bg-green-100 text-green-900" },
  declined: { label: "Declined", className: "bg-stone-200 text-stone-700" },
  cancelled: { label: "Cancelled", className: "bg-stone-200 text-stone-700" },
};
const BUTTON: Record<OrderStatus, string> = {
  received: "", accepted: "Accept", out_for_delivery: "Out for delivery", ready: "Ready",
  completed: "Completed", declined: "Decline", cancelled: "Cancel",
};
const TYPE: Record<OrderType, string> = { room_service: "Room service", collection: "Collection", table: "Table pre-order" };

const VIEWS = {
  active: { label: "To do", status: ["received", "accepted", "out_for_delivery", "ready"] as OrderStatus[] },
  all: { label: "All", status: [] as OrderStatus[] },
};

function OrdersScreen() {
  const { refreshSummary } = useAdmin();
  const [view, setView] = useState<keyof typeof VIEWS>("active");
  const [type, setType] = useState<"" | OrderType>("");
  const [q, setQ] = useState(useSearchParams().get("q") ?? ""); // e.g. a pre-order reference from Table bookings
  const list = useLoad(() => getOrders({ status: VIEWS[view].status, type: type || undefined, q: q.trim() || undefined }), [view, type, q]);
  const { reload } = list;

  // Refresh every 30 seconds while the screen is open, so new orders appear by themselves.
  useEffect(() => {
    const timer = setInterval(() => { reload(); refreshSummary(); }, 30_000);
    return () => clearInterval(timer);
  }, [reload, refreshSummary]);

  return (
    <div className="max-w-3xl space-y-4">
      <PageTitle>Food orders</PageTitle>
      <Card>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Show">
            <select className={inputClass} value={view} onChange={(e) => setView(e.target.value as keyof typeof VIEWS)}>
              {Object.entries(VIEWS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </Field>
          <Field label="Type">
            <select className={inputClass} value={type} onChange={(e) => setType(e.target.value as "" | OrderType)}>
              <option value="">All</option>
              {Object.entries(TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Search">
            <input className={inputClass} placeholder="Reference, name, phone or room" value={q} onChange={(e) => setQ(e.target.value)} />
          </Field>
        </div>
        <p className="mt-2 text-sm text-stone-500">This list updates by itself every 30 seconds.</p>
      </Card>

      {list.loading && !list.data && <Loading />}
      {list.error && <ErrorBox message={list.error} onRetry={reload} />}
      {list.data?.items.length === 0 && <p className="text-stone-600">No orders here.</p>}
      <ul className="space-y-3">
        {list.data?.items.map((o) => (
          <li key={o.id}><OrderCard order={o} onChanged={() => { reload(); refreshSummary(); }} /></li>
        ))}
      </ul>
    </div>
  );
}

function OrderCard({ order: o, onChanged }: { order: Order; onChanged: () => void }) {
  const [busy, setBusy] = useState<OrderStatus | null>(null);
  const [asking, setAsking] = useState<OrderStatus | null>(null);
  const [error, setError] = useState("");
  const b = BADGE[o.status];

  async function move(status: OrderStatus, message?: string) {
    setBusy(status); setError("");
    try { await setOrderStatus(o.id, status, message); } catch (e) { setError(errorMessage(e)); }
    setBusy(null); setAsking(null);
    onChanged();       // reload in every case: on 409 someone else moved it on
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-lg font-bold">
            {TYPE[o.type]}{o.roomNumber ? ` · Room ${o.roomNumber}` : ""}
          </p>
          <p className="text-sm text-stone-600">
            {o.reference} · ordered {windhoekTime(o.createdAt)}
            {o.estimatedReadyAt && ` · ready about ${windhoekTime(o.estimatedReadyAt).split(", ")[1]}`}
          </p>
          {o.tableBookingReference && <p className="text-sm">For table booking {o.tableBookingReference}</p>}
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-medium ${b.className}`}>{b.label}</span>
      </div>

      <ul className="my-3 space-y-1">
        {o.items.map((l, i) => (
          <li key={i} className="flex justify-between gap-2">
            <span><b>{l.quantity} ×</b> {l.name}{l.side ? ` (with ${l.side})` : ""}{l.notes ? ` · “${l.notes}”` : ""}</span>
            <span className="whitespace-nowrap">{money(l.lineTotal)}</span>
          </li>
        ))}
      </ul>
      <div className="border-t border-stone-200 pt-2 text-sm">
        {o.deliveryFee > 0 && <p className="flex justify-between"><span>Delivery</span><span>{money(o.deliveryFee)}</span></p>}
        <p className="flex justify-between font-bold"><span>Total, pay by {o.paymentMethod}</span><span>{money(o.total)}</span></p>
      </div>
      <p className="mt-2 text-sm">{o.guestName} · <a className="underline" href={`tel:${o.phone}`}>{o.phone}</a></p>
      {o.notes && <p className="text-sm">Note: “{o.notes}”</p>}

      {error && <div className="mt-2"><ErrorBox message={error} /></div>}
      <div className="mt-3 flex flex-wrap gap-2">
        {nextOrderSteps(o).map((s) => (
          <Button key={s} variant={s === "declined" || s === "cancelled" ? "danger" : "primary"} busy={busy === s} disabled={busy !== null}
            onClick={() => (s === "declined" || s === "cancelled" ? setAsking(s) : move(s))}>
            {BUTTON[s]}
          </Button>
        ))}
      </div>
      {asking && (
        <ConfirmDialog
          title={asking === "declined" ? "Decline this order?" : "Cancel this order?"}
          text={o.email ? `${o.guestName} will get an email straight away.` : `${o.guestName} gave no email. Please phone them on ${o.phone}.`}
          confirmLabel={asking === "declined" ? "Yes, decline" : "Yes, cancel"}
          withMessage={!!o.email}
          danger
          onClose={() => setAsking(null)}
          onConfirm={(message) => move(asking, message)}
        />
      )}
    </Card>
  );
}

export default function OrdersPage() {
  return <Suspense><OrdersScreen /></Suspense>;
}
