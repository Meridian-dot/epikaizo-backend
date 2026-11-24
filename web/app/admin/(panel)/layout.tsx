// web/app/admin/(panel)/layout.tsx
// Wraps every admin screen except the login page: checks the login, shows the header and the sidebar.
// The "(panel)" folder name has brackets, so it does NOT appear in the web address.
"use client";
import { Suspense, useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { Summary, User } from "@/types/api";
import { getSummary, logout, me } from "@/lib/admin-api";
import { ApiError } from "@/lib/api";
import { errorMessage } from "@/lib/use-load";
import { AdminContext } from "@/components/admin/AdminContext";
import { ErrorBox, Loading } from "@/components/admin/ui";

type NavItem = { href: string; label: string; badge?: (s: Summary) => number | undefined; managerOnly?: boolean };
const NAV: NavItem[] = [
  { href: "/admin", label: "Home" },
  { href: "/admin/bookings/rooms", label: "Room bookings", badge: (s) => s.pendingRoomRequests },
  { href: "/admin/bookings/tables", label: "Table bookings", badge: (s) => s.pendingTableRequests },
  { href: "/admin/orders", label: "Food orders", badge: (s) => s.newOrders },
  { href: "/admin/rooms", label: "Rooms" },
  { href: "/admin/blocked-dates", label: "Blocked dates" },
  { href: "/admin/menu", label: "Menu" },
  { href: "/admin/content", label: "Website text and photos" },
  { href: "/admin/settings", label: "Settings", managerOnly: true },
];

// Newer Next.js versions need a <Suspense> wrapper around anything that reads the web address.
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<Loading />}>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}

function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // 1. Who is logged in? If nobody, go to the login page.
  useEffect(() => {
    me()
      .then(setUser)
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) router.replace(`/admin/login?next=${encodeURIComponent(pathname)}`);
        else setError(errorMessage(e));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. The sidebar counts. A failure here is not serious, so it is ignored.
  const refreshSummary = useCallback(() => { getSummary().then(setSummary).catch(() => {}); }, []);
  useEffect(() => { if (user) refreshSummary(); }, [user, refreshSummary, pathname]);

  async function doLogout() {
    await logout().catch(() => {});
    router.replace("/admin/login");
  }

  if (error) return <div className="p-6"><ErrorBox message={error} onRetry={() => window.location.reload()} /></div>;
  if (!user) return <Loading />;

  const items = NAV.filter((n) => !n.managerOnly || user.role === "manager");
  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  return (
    <AdminContext.Provider value={{ user, summary, refreshSummary }}>
      <div className="min-h-screen bg-stone-100 text-stone-900">
        <header className="flex items-center justify-between gap-3 bg-[#3E160C] px-4 py-3 text-white">
          <button className="rounded border border-white/40 px-3 py-1 md:hidden" onClick={() => setMenuOpen(!menuOpen)}>Menu</button>
          <span className="font-bold tracking-wide text-[#B9942C]">EPIKAIZO ADMIN</span>
          <span className="ml-auto text-sm">
            {user.name} · {user.role === "manager" ? "Manager" : "Staff"}
          </span>
          <button onClick={doLogout} className="rounded bg-white/10 px-3 py-1 text-sm hover:bg-white/20">Log out</button>
        </header>

        <div className="md:flex">
          <nav className={`${menuOpen ? "block" : "hidden"} border-b border-stone-200 bg-white md:block md:min-h-[calc(100vh-52px)] md:w-60 md:border-b-0 md:border-r`}>
            <ul className="p-2">
              {items.map((n) => {
                const count = summary && n.badge ? n.badge(summary) : undefined;
                return (
                  <li key={n.href}>
                    <Link
                      href={n.href}
                      onClick={() => setMenuOpen(false)}
                      className={`flex items-center justify-between rounded-lg px-3 py-3 ${isActive(n.href) ? "bg-amber-100 font-semibold text-[#3E160C]" : "hover:bg-stone-100"}`}
                    >
                      {n.label}
                      {!!count && <span className="rounded-full bg-red-600 px-2 text-sm font-bold text-white">{count}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <main className="flex-1 p-4 md:p-8">{children}</main>
        </div>
      </div>
    </AdminContext.Provider>
  );
}
