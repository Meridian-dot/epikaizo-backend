// web/lib/admin-api.ts
// ONE function per endpoint. Screens only ever call these functions, never api() or fetch directly.
// Each function either uses the pretend data in admin-mock-data.ts or calls the real API.
import { api, ApiError } from "./api";
import * as mock from "./admin-mock-data";
import type {
  AdminRoom, AdminSetup, Amenity, BlockedDate, BookingAction, BookingStatus, ContentKey, IsoDate, MenuCategory,
  MenuItem, Order, OrderStatus, OrderType, PageContent, PageSection, Paged, Photo, Role, RoomBooking, SiteSettings,
  Summary, TableBooking, Upload, User,
} from "@/types/api";

// ---------------------------------------------------------------------------
// The switch
// ---------------------------------------------------------------------------
const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === "true";

// When Dev B says an area is live on the API, add its name here to stop mocking just that area,
// while everything else stays on mocks. Example: new Set(["auth", "rooms"])
type Area = "auth" | "summary" | "rooms" | "photos" | "menu" | "content" | "roomBookings"
  | "tableBookings" | "blocked" | "orders" | "settings" | "users";
const LIVE_AREAS = new Set<Area>([]);
const mocked = (area: Area) => USE_MOCKS && !LIVE_AREAS.has(area);

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Pretend to be the network: wait a moment, then return a COPY so screens can't change mock data by accident.
async function fake<T>(fn: () => T): Promise<T> {
  await wait(250);
  const result = fn();
  return result === undefined ? result : structuredClone(result);
}

// The real call. Staging sleeps when idle: if a read fails with 502 or 504, wait and try once more.
async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  try {
    return await api<T>(path, init);
  } catch (e) {
    const isRead = (init.method ?? "GET") === "GET";
    if (isRead && e instanceof ApiError && (e.status === 502 || e.status === 504)) {
      await wait(4000);
      return api<T>(path, init);
    }
    throw e;
  }
}
const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

const notFound = () => new ApiError(404, "not_found", "That record no longer exists.");
const nextId = (list: { id: number }[]) => Math.max(0, ...list.map((x) => x.id)) + 1;
const stamp = () => new Date().toISOString();

// Mock login state. sessionStorage is used ONLY in mock mode so a page refresh keeps you logged in.
// The real API uses an httpOnly cookie, and the dashboard stores nothing.
function mockUser(): User | null {
  if (typeof window === "undefined") return null;
  const username = sessionStorage.getItem("mockUser");
  return mock.users.find((u) => u.username === username) ?? null;
}
function requireMockRole(role?: Role) {
  const user = mockUser();
  if (!user) throw new ApiError(401, "not_logged_in", "Please log in.");
  if (role === "manager" && user.role !== "manager") throw new ApiError(403, "forbidden", "Only a manager can do this.");
  return user;
}

// ---------------------------------------------------------------------------
// Login and sessions (spec section 4)
// ---------------------------------------------------------------------------
export const login = (username: string, password: string) =>
  mocked("auth")
    ? fake(() => {
        const user = mock.users.find((u) => u.username === username.trim().toLowerCase());
        if (!user || password !== mock.MOCK_PASSWORD) throw new ApiError(401, "invalid_credentials", "Wrong username or password.");
        sessionStorage.setItem("mockUser", user.username);
        return user;
      })
    : call<{ user: User }>("/auth/login", json("POST", { username: username.trim(), password })).then((r) => r.user);

export const me = () =>
  mocked("auth") ? fake(() => requireMockRole()) : call<{ user: User }>("/auth/me").then((r) => r.user);

export const logout = () =>
  mocked("auth") ? fake(() => { sessionStorage.removeItem("mockUser"); }) : call<void>("/auth/logout", { method: "POST" });

// ---------------------------------------------------------------------------
// Dashboard home
// ---------------------------------------------------------------------------
export const getSummary = () =>
  mocked("summary")
    ? fake((): Summary => {
        const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Windhoek" }).format(new Date());
        const live = (s: BookingStatus) => s === "confirmed";
        return {
          pendingRoomRequests: mock.roomBookings.filter((b) => b.status === "pending").length,
          pendingTableRequests: mock.tableBookings.filter((b) => b.status === "pending").length,
          arrivalsToday: mock.roomBookings.filter((b) => live(b.status) && b.checkIn === today).length,
          departuresToday: mock.roomBookings.filter((b) => live(b.status) && b.checkOut === today).length,
          tableBookingsToday: mock.tableBookings.filter((b) => live(b.status) && b.date === today).length,
          newOrders: mock.orders.filter((o) => o.status === "received").length,
          ordersInProgress: mock.orders.filter((o) => ["accepted", "out_for_delivery", "ready"].includes(o.status)).length,
        };
      })
    : call<Summary>("/admin/summary");

// ---------------------------------------------------------------------------
// Rooms and amenities
// ---------------------------------------------------------------------------
export type RoomInput = Pick<AdminRoom, "name" | "description" | "totalUnits" | "amenityIds">
  & Partial<Pick<AdminRoom, "isActive" | "sortOrder">>;

export const getRooms = () =>
  mocked("rooms") ? fake(() => [...mock.rooms].sort((a, b) => a.sortOrder - b.sortOrder)) : call<AdminRoom[]>("/admin/rooms");

export const getRoom = async (id: number) => {
  const room = (await getRooms()).find((r) => r.id === id); // the spec has no GET /admin/rooms/:id
  if (!room) throw notFound();
  return room;
};

export const createRoom = (body: RoomInput) =>
  mocked("rooms")
    ? fake(() => {
        const slug = body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
        if (mock.rooms.some((r) => r.slug === slug)) throw new ApiError(409, "conflict", "Already used", { name: ["A room with this name already exists."] });
        const room: AdminRoom = { id: nextId(mock.rooms), slug, isActive: true, sortOrder: mock.rooms.length + 1, photos: [], setups: [],
          createdAt: stamp(), updatedAt: stamp(), ...body };
        mock.rooms.push(room);
        return room;
      })
    : call<AdminRoom>("/admin/rooms", json("POST", body));

export const updateRoom = (id: number, changes: Partial<RoomInput>) =>
  mocked("rooms")
    ? fake(() => {
        const room = mock.rooms.find((r) => r.id === id);
        if (!room) throw notFound();
        Object.assign(room, changes, { updatedAt: stamp() });
        return room;
      })
    : call<AdminRoom>(`/admin/rooms/${id}`, json("PATCH", changes));

export const getAmenities = () =>
  mocked("rooms") ? fake(() => [...mock.amenities].sort((a, b) => a.name.localeCompare(b.name))) : call<Amenity[]>("/admin/amenities");

export const createAmenity = (name: string) =>
  mocked("rooms")
    ? fake(() => {
        if (mock.amenities.some((a) => a.name.toLowerCase() === name.toLowerCase()))
          throw new ApiError(409, "conflict", "Already used", { name: ["This amenity already exists."] });
        const a: Amenity = { id: nextId(mock.amenities), name, icon: null };
        mock.amenities.push(a);
        return a;
      })
    : call<Amenity>("/admin/amenities", json("POST", { name }));

// Setups and prices. This is where the owner sets prices.
export type SetupInput = Pick<AdminSetup, "name" | "maxGuests" | "pricePerNight" | "onRequest"> & Partial<Pick<AdminSetup, "sortOrder">>;

export const createSetup = (roomId: number, body: SetupInput) =>
  mocked("rooms")
    ? fake(() => {
        const room = mock.rooms.find((r) => r.id === roomId); if (!room) throw notFound();
        const s: AdminSetup = { id: mock.nextSetupId(), isActive: true, sortOrder: room.setups.length + 1, ...body };
        room.setups.push(s);
        return s;
      })
    : call<AdminSetup>(`/admin/rooms/${roomId}/setups`, json("POST", body));

export const updateSetup = (id: number, changes: Partial<SetupInput & { isActive: boolean }>) =>
  mocked("rooms")
    ? fake(() => {
        const s = mock.rooms.flatMap((r) => r.setups).find((x) => x.id === id); if (!s) throw notFound();
        Object.assign(s, changes);
        return s;
      })
    : call<AdminSetup>(`/admin/setups/${id}`, json("PATCH", changes));

// ---------------------------------------------------------------------------
// Photos (two steps: upload the file, then attach the URL)
// ---------------------------------------------------------------------------
export type PhotoTarget = { roomTypeId: number } | { menuItemId: number } | { isGallery: true };

export const uploadFile = (file: File) =>
  mocked("photos")
    ? (async (): Promise<Upload> => { await wait(1200); return { url: URL.createObjectURL(file), width: 1600, height: 1067 }; })()
    : (() => { const form = new FormData(); form.append("file", file); return call<Upload>("/admin/uploads", { method: "POST", body: form }); })();

// Finds the list a photo lives in (a room's photos, or the gallery).
function photoList(photoId: number): Photo[] | undefined {
  if (mock.gallery.some((p) => p.id === photoId)) return mock.gallery;
  return mock.rooms.find((r) => r.photos.some((p) => p.id === photoId))?.photos;
}

export const attachPhoto = (url: string, alt: string, target: PhotoTarget) =>
  mocked("photos")
    ? fake(() => {
        const ids = [...mock.gallery, ...mock.rooms.flatMap((r) => r.photos), ...mock.menuItems.flatMap((m) => (m.photo ? [m.photo] : []))];
        const photo: Photo = { id: nextId(ids), url, alt, sortOrder: 0 };
        if ("isGallery" in target) { photo.sortOrder = mock.gallery.length + 1; mock.gallery.push(photo); }
        else if ("roomTypeId" in target) {
          const room = mock.rooms.find((r) => r.id === target.roomTypeId); if (!room) throw notFound();
          photo.sortOrder = room.photos.length + 1; room.photos.push(photo);
        } else {
          const item = mock.menuItems.find((m) => m.id === target.menuItemId); if (!item) throw notFound();
          photo.sortOrder = 1; item.photo = photo; // a menu item has at most one photo
        }
        return photo;
      })
    : call<Photo>("/admin/photos", json("POST", { url, alt, ...target }));

export const getGallery = () =>
  mocked("photos") ? fake(() => [...mock.gallery].sort((a, b) => a.sortOrder - b.sortOrder)) : call<Photo[]>("/admin/photos?gallery=true");

export const reorderPhotos = (ids: number[]) =>
  mocked("photos")
    ? fake(() => {
        const list = photoList(ids[0]);
        list?.forEach((p) => { p.sortOrder = ids.indexOf(p.id) + 1; });
        list?.sort((a, b) => a.sortOrder - b.sortOrder);
      })
    : call<void>("/admin/photos/order", json("PUT", { ids }));

export const updatePhotoAlt = (id: number, alt: string) =>
  mocked("photos")
    ? fake(() => {
        const p = [...mock.gallery, ...mock.rooms.flatMap((r) => r.photos), ...mock.menuItems.flatMap((m) => (m.photo ? [m.photo] : []))].find((x) => x.id === id);
        if (!p) throw notFound();
        p.alt = alt;
        return p;
      })
    : call<Photo>(`/admin/photos/${id}`, json("PATCH", { alt }));

export const deletePhoto = (id: number) =>
  mocked("photos")
    ? fake(() => {
        const list = photoList(id);
        if (list) list.splice(list.findIndex((p) => p.id === id), 1);
        const item = mock.menuItems.find((m) => m.photo?.id === id);
        if (item) item.photo = null;
      })
    : call<void>(`/admin/photos/${id}`, { method: "DELETE" });

// ---------------------------------------------------------------------------
// Menu
// ---------------------------------------------------------------------------
export type MenuItemInput = Omit<MenuItem, "id" | "photo">;

export const getCategories = () =>
  mocked("menu")
    ? fake(() => mock.menuCategories
        .map((c) => ({ ...c, itemCount: mock.menuItems.filter((i) => i.categoryId === c.id).length }))
        .sort((a, b) => a.sortOrder - b.sortOrder))
    : call<MenuCategory[]>("/admin/menu/categories");

export const createCategory = (name: string) =>
  mocked("menu")
    ? fake(() => {
        const c: MenuCategory = { id: nextId(mock.menuCategories), name, sortOrder: mock.menuCategories.length + 1, itemCount: 0 };
        mock.menuCategories.push(c);
        return c;
      })
    : call<MenuCategory>("/admin/menu/categories", json("POST", { name }));

export const renameCategory = (id: number, name: string) =>
  mocked("menu")
    ? fake(() => { const c = mock.menuCategories.find((x) => x.id === id); if (!c) throw notFound(); c.name = name; return c; })
    : call<MenuCategory>(`/admin/menu/categories/${id}`, json("PATCH", { name }));

export const deleteCategory = (id: number) =>
  mocked("menu")
    ? fake(() => {
        if (mock.menuItems.some((i) => i.categoryId === id))
          throw new ApiError(409, "not_empty", "This category still has dishes. Move or delete them first.");
        mock.menuCategories.splice(mock.menuCategories.findIndex((c) => c.id === id), 1);
      })
    : call<void>(`/admin/menu/categories/${id}`, { method: "DELETE" });

export const getMenuItems = (categoryId?: number) =>
  mocked("menu")
    ? fake(() => mock.menuItems.filter((i) => categoryId === undefined || i.categoryId === categoryId).sort((a, b) => a.sortOrder - b.sortOrder))
    : call<MenuItem[]>(`/admin/menu/items${categoryId ? `?categoryId=${categoryId}` : ""}`);

export const createMenuItem = (body: MenuItemInput) =>
  mocked("menu")
    ? fake(() => { const item: MenuItem = { id: nextId(mock.menuItems), photo: null, ...body }; mock.menuItems.push(item); return item; })
    : call<MenuItem>("/admin/menu/items", json("POST", body));

export const updateMenuItem = (id: number, changes: Partial<MenuItemInput>) =>
  mocked("menu")
    ? fake(() => { const i = mock.menuItems.find((x) => x.id === id); if (!i) throw notFound(); Object.assign(i, changes); return i; })
    : call<MenuItem>(`/admin/menu/items/${id}`, json("PATCH", changes));

export const deleteMenuItem = (id: number) =>
  mocked("menu")
    ? fake(() => { mock.menuItems.splice(mock.menuItems.findIndex((i) => i.id === id), 1); })
    : call<void>(`/admin/menu/items/${id}`, { method: "DELETE" });

// ---------------------------------------------------------------------------
// Room bookings
// ---------------------------------------------------------------------------
export type RoomBookingFilters = { status?: BookingStatus[]; from?: IsoDate; to?: IsoDate; q?: string;
  sort?: "createdAt" | "checkIn"; page?: number; pageSize?: number };

function toQuery(f: Record<string, string | number | string[] | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(f)) {
    if (value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) continue;
    params.set(key, Array.isArray(value) ? value.join(",") : String(value));
  }
  return params.toString();
}

function page<T>(items: T[], pageNo = 1, pageSize = 20): Paged<T> {
  return { items: items.slice((pageNo - 1) * pageSize, pageNo * pageSize), total: items.length, page: pageNo, pageSize };
}

const matches = (q: string | undefined, ...fields: string[]) =>
  !q || fields.some((f) => f.toLowerCase().includes(q.toLowerCase()));

export const getRoomBookings = (f: RoomBookingFilters = {}) =>
  mocked("roomBookings")
    ? fake(() => {
        const list = mock.roomBookings
          .filter((b) => !f.status?.length || f.status.includes(b.status))
          .filter((b) => (!f.to || b.checkIn <= f.to) && (!f.from || b.checkOut > f.from)) // stays that overlap
          .filter((b) => matches(f.q, b.guestName, b.email, b.phone, b.reference))
          .sort((a, b) => (f.sort === "checkIn" ? a.checkIn.localeCompare(b.checkIn) : b.createdAt.localeCompare(a.createdAt)));
        return page(list, f.page, f.pageSize);
      })
    : call<Paged<RoomBooking>>(`/admin/bookings/rooms?${toQuery(f)}`);

export const getRoomBooking = (id: number) =>
  mocked("roomBookings")
    ? fake(() => { const b = mock.roomBookings.find((x) => x.id === id); if (!b) throw notFound(); return b; })
    : call<RoomBooking>(`/admin/bookings/rooms/${id}`);

// Which buttons each status allows (spec section 6). The API has the final say.
export const allowedActions: Record<BookingStatus, BookingAction[]> = {
  pending: ["confirm", "decline"],
  confirmed: ["cancel"],
  expired: ["confirm"],
  declined: [],
  cancelled: [],
};

function decideMock<T extends { status: BookingStatus; decidedAt: string | null; decidedBy: { id: number; name: string } | null }>(
  booking: T | undefined, action: BookingAction,
): T {
  if (!booking) throw notFound();
  if (!allowedActions[booking.status].includes(action))
    throw new ApiError(409, "invalid_state", "Someone else has already changed this booking. It has been reloaded.");
  const user = requireMockRole();
  booking.status = action === "confirm" ? "confirmed" : action === "decline" ? "declined" : "cancelled";
  booking.decidedAt = stamp();
  booking.decidedBy = { id: user.id, name: user.name };
  return booking;
}

export const decideRoomBooking = (id: number, action: BookingAction, message?: string) =>
  mocked("roomBookings")
    ? fake(() => {
        const b = decideMock(mock.roomBookings.find((x) => x.id === id), action);
        if (b.status === "confirmed") b.expiresAt = null;
        return b;
      })
    : call<RoomBooking>(`/admin/bookings/rooms/${id}`, json("PATCH", { action, message: message || undefined }));

// ---------------------------------------------------------------------------
// Table bookings
// ---------------------------------------------------------------------------
export type TableBookingFilters = { date?: IsoDate; status?: BookingStatus; q?: string; page?: number; pageSize?: number };

export const getTableBookings = (f: TableBookingFilters = {}) =>
  mocked("tableBookings")
    ? fake(() => {
        const list = mock.tableBookings
          .filter((b) => (!f.date || b.date === f.date) && (!f.status || b.status === f.status))
          .filter((b) => matches(f.q, b.guestName, b.email, b.phone, b.reference))
          .sort((a, b) => (a.date + a.timeSlot).localeCompare(b.date + b.timeSlot));
        return page(list, f.page, f.pageSize);
      })
    : call<Paged<TableBooking>>(`/admin/bookings/tables?${toQuery(f)}`);

export const decideTableBooking = (id: number, action: BookingAction, message?: string) =>
  mocked("tableBookings")
    ? fake(() => {
        const b = decideMock(mock.tableBookings.find((x) => x.id === id), action);
        // Declining or cancelling a table also cancels its pre-order.
        const pre = mock.orders.find((o) => o.reference === b.preOrderReference);
        if (pre && b.status !== "confirmed") pre.status = "cancelled";
        return b;
      })
    : call<TableBooking>(`/admin/bookings/tables/${id}`, json("PATCH", { action, message: message || undefined }));

// ---------------------------------------------------------------------------
// Blocked dates
// ---------------------------------------------------------------------------
export type BlockedDateInput = Omit<BlockedDate, "id" | "roomTypeName">;

export const getBlockedDates = (f: { roomTypeId?: number; from?: IsoDate; to?: IsoDate } = {}) =>
  mocked("blocked")
    ? fake(() => mock.blockedDates
        .filter((b) => (!f.roomTypeId || b.roomTypeId === f.roomTypeId) && (!f.to || b.startDate < f.to) && (!f.from || b.endDate > f.from))
        .sort((a, b) => a.startDate.localeCompare(b.startDate)))
    : call<BlockedDate[]>(`/admin/blocked-dates?${toQuery(f)}`);

export const createBlockedDate = (body: BlockedDateInput) =>
  mocked("blocked")
    ? fake(() => {
        const room = mock.rooms.find((r) => r.id === body.roomTypeId);
        if (!room) throw new ApiError(400, "invalid_input", "Some fields are invalid", { roomTypeId: ["Choose a room."] });
        if (body.units > room.totalUnits)
          throw new ApiError(409, "unavailable", `${room.name} only has ${room.totalUnits} rooms.`);
        const b: BlockedDate = { id: nextId(mock.blockedDates), roomTypeName: room.name, ...body };
        mock.blockedDates.push(b);
        return b;
      })
    : call<BlockedDate>("/admin/blocked-dates", json("POST", body));

export const deleteBlockedDate = (id: number) =>
  mocked("blocked")
    ? fake(() => { mock.blockedDates.splice(mock.blockedDates.findIndex((b) => b.id === id), 1); })
    : call<void>(`/admin/blocked-dates/${id}`, { method: "DELETE" });

// ---------------------------------------------------------------------------
// Website text
// ---------------------------------------------------------------------------
export const getContent = () => (mocked("content") ? fake(() => mock.content) : call<PageContent[]>("/admin/content"));

export type ContentInput = { title: string; subtitle: string; sections: PageSection[] };

export const saveContent = (key: ContentKey, body: ContentInput) =>
  mocked("content")
    ? fake(() => {
        const page = mock.content.find((c) => c.key === key);
        if (!page) throw notFound();
        Object.assign(page, body, { updatedAt: stamp() });
        return page;
      })
    : call<PageContent>(`/admin/content/${key}`, json("PUT", body));

// ---------------------------------------------------------------------------
// Settings (manager)
// ---------------------------------------------------------------------------
export const getSettings = () =>
  mocked("settings") ? fake(() => mock.settings) : call<SiteSettings>("/admin/settings");

// PUT sends the whole object. Manager only.
export const saveSettings = (s: SiteSettings) =>
  mocked("settings")
    ? fake(() => { requireMockRole("manager"); Object.assign(mock.settings, s); return mock.settings; })
    : call<SiteSettings>("/admin/settings", json("PUT", s));

export const getUsers = () =>
  mocked("users") ? fake(() => { requireMockRole("manager"); return mock.users; }) : call<User[]>("/admin/users");

export const createUser = (body: { name: string; username: string; password: string; role: Role }) =>
  mocked("users")
    ? fake(() => {
        requireMockRole("manager");
        if (!/^[a-z0-9.]{3,30}$/.test(body.username))
          throw new ApiError(400, "invalid_input", "Some fields are invalid", { username: ["3 to 30 lowercase letters, numbers or dots."] });
        if (mock.users.some((u) => u.username === body.username))
          throw new ApiError(409, "conflict", "Already used", { username: ["Someone already has this username."] });
        if (body.password.length < 10)
          throw new ApiError(400, "invalid_input", "Some fields are invalid", { password: ["Use at least 10 characters."] });
        const u: User = { id: nextId(mock.users), name: body.name, username: body.username, role: body.role };
        mock.users.push(u);
        return u;
      })
    : call<User>("/admin/users", json("POST", body));

export const updateUser = (id: number, changes: { name?: string; role?: Role; password?: string }) =>
  mocked("users")
    ? fake(() => {
        requireMockRole("manager");
        const u = mock.users.find((x) => x.id === id); if (!u) throw notFound();
        if (changes.name) u.name = changes.name;
        if (changes.role) u.role = changes.role;
        return u;
      })
    : call<User>(`/admin/users/${id}`, json("PATCH", changes));

export const deleteUser = (id: number) =>
  mocked("users")
    ? fake(() => {
        const current = requireMockRole("manager");
        const managers = mock.users.filter((u) => u.role === "manager");
        const target = mock.users.find((u) => u.id === id);
        if (id === current.id || (target?.role === "manager" && managers.length === 1))
          throw new ApiError(409, "invalid_state", "You can't remove your own login or the last manager.");
        mock.users.splice(mock.users.findIndex((u) => u.id === id), 1);
      })
    : call<void>(`/admin/users/${id}`, { method: "DELETE" });

// ---------------------------------------------------------------------------
// Food orders (kitchen and reception)
// ---------------------------------------------------------------------------
export type OrderFilters = { status?: OrderStatus[]; type?: OrderType; date?: IsoDate; q?: string; page?: number; pageSize?: number };

export const getOrders = (f: OrderFilters = {}) =>
  mocked("orders")
    ? fake(() => {
        const list = mock.orders
          .filter((o) => !f.status?.length || f.status.includes(o.status))
          .filter((o) => !f.type || o.type === f.type)
          .filter((o) => matches(f.q, o.reference, o.guestName, o.phone, o.roomNumber ?? ""))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        return page(list, f.page, f.pageSize ?? 50);
      })
    : call<Paged<Order>>(`/admin/orders?${toQuery(f)}`);

// The next steps each order status allows (spec section 6). Room service goes out for delivery;
// collection and table orders become ready.
export function nextOrderSteps(o: Pick<Order, "status" | "type">): OrderStatus[] {
  switch (o.status) {
    case "received": return ["accepted", "declined"];
    case "accepted": return o.type === "room_service" ? ["out_for_delivery", "cancelled"] : ["ready", "cancelled"];
    case "out_for_delivery":
    case "ready": return ["completed"];
    default: return [];
  }
}

export const setOrderStatus = (id: number, status: OrderStatus, message?: string) =>
  mocked("orders")
    ? fake(() => {
        const o = mock.orders.find((x) => x.id === id); if (!o) throw notFound();
        if (!nextOrderSteps(o).includes(status))
          throw new ApiError(409, "invalid_state", "Someone else has already moved this order on. It has been reloaded.");
        const user = requireMockRole();
        o.status = status; o.updatedAt = stamp(); o.decidedBy = { id: user.id, name: user.name };
        return o;
      })
    : call<Order>(`/admin/orders/${id}`, json("PATCH", { status, message: message || undefined }));
