// web/types/api.ts: matches Docking Spec v1.1
export type IsoDate = string;   // "2026-12-20" (calendar date)
export type TimeOfDay = string; // "19:00" (Windhoek)
export type Timestamp = string; // "2026-12-01T10:00:00.000Z" (UTC)
export type Role = "manager" | "staff";
export type BookingStatus = "pending" | "confirmed" | "declined" | "cancelled" | "expired";
export type BookingAction = "confirm" | "decline" | "cancel";
export type OrderType = "room_service" | "collection" | "table";
export type OrderStatus = "received" | "accepted" | "out_for_delivery" | "ready"
  | "completed" | "declined" | "cancelled";
export type PaymentMethod = "cash" | "card";
export type ContentKey = "home" | "about" | "rooms" | "restaurant" | "events" | "contact";
export type DietaryTag = "vegetarian" | "vegan" | "halal" | "gluten-free" | "contains-nuts" | "spicy";
export type ContactTopic = "general" | "event" | "group_dining";

// ---- Shared ----
export interface Photo { id: number; url: string; alt: string; sortOrder: number }
export interface Amenity { id: number; name: string; icon: string | null }
export interface Paged<T> { items: T[]; total: number; page: number; pageSize: number }
export interface ApiErrorBody { error: { code: string; message: string; fields?: Record<string, string[]> } }

// ---- Settings and content ----
export interface SiteSettings {
  contact: { phone: string; whatsapp: string; email: string; address: string };
  links: { instagram: string; googleMaps: string };
  checkInTime: TimeOfDay; checkOutTime: TimeOfDay;
  restaurant: { openingTime: TimeOfDay; closingTime: TimeOfDay; slotMinutes: 15 | 30 | 60;
    diningMinutes: number; maxCoversPerSlot: number; preOrderNoticeMinutes: number };
  ordering: { roomService: { from: TimeOfDay; to: TimeOfDay; deliveryFee: number };
    collection: { from: TimeOfDay; to: TimeOfDay }; prepMinutes: number; paymentMethods: PaymentMethod[] };
}
export interface PageSection { heading: string; body: string }
export interface PageContent { key: ContentKey; title: string; subtitle: string;
  sections: PageSection[]; updatedAt: Timestamp }
export interface ContactRequest { name: string; phone: string; email?: string; topic: ContactTopic;
  message: string; eventDate?: IsoDate; groupSize?: number }

// ---- Rooms ----
export interface Setup { id: number; name: string; maxGuests: number; pricePerNight: number; onRequest: boolean }
export interface PublicRoom { id: number; name: string; slug: string; description: string;
  maxGuests: number; fromPrice: number; amenities: Amenity[]; photos: Photo[]; setups: Setup[] }
export interface RoomAvailability { roomTypeId: number; from: IsoDate; to: IsoDate;
  nights: { date: IsoDate; available: number }[] }
export interface RoomSearch { checkIn: IsoDate; checkOut: IsoDate; nights: number; guests: number;
  results: { roomTypeId: number; name: string; slug: string; photo: Photo | null;
    availableRooms: number; setups: (Setup & { totalPrice: number })[] }[] }
export interface RoomBookingRequest { roomTypeId: number; setupId: number; checkIn: IsoDate;
  checkOut: IsoDate; guests: number; guestName: string; email: string; phone: string; notes?: string }
export interface RoomBookingCreated { reference: string; status: "pending"; roomTypeName: string;
  setupName: string; checkIn: IsoDate; checkOut: IsoDate; nights: number; guests: number;
  pricePerNight: number; totalPrice: number; expiresAt: Timestamp }

// ---- Menu, tables and orders ----
export interface PublicMenuItem { id: number; name: string; description: string; price: number;
  dietaryTags: DietaryTag[]; isAvailable: boolean; sideOptions: string[];
  photo: { url: string; alt: string } | null }
export interface PublicMenuCategory { id: number; name: string; items: PublicMenuItem[] }
export interface TableSlots { date: IsoDate; partySize: number;
  slots: { time: TimeOfDay; seatsLeft: number; available: boolean }[] }
export interface OrderItemInput { menuItemId: number; quantity: number; side?: string; notes?: string }
export interface TableBookingRequest { date: IsoDate; timeSlot: TimeOfDay; partySize: number;
  guestName: string; email: string; phone: string; notes?: string;
  preOrder?: { paymentMethod: PaymentMethod; items: OrderItemInput[] } }
export interface TableBookingCreated { reference: string; status: "pending"; date: IsoDate;
  timeSlot: TimeOfDay; partySize: number; preOrder: { reference: string; total: number } | null }
export interface OrderRequest { type: "room_service" | "collection"; roomNumber?: string;
  guestName: string; phone: string; email?: string; paymentMethod: PaymentMethod; notes?: string;
  items: OrderItemInput[] }
export interface OrderLine { menuItemId: number; name: string; quantity: number; side: string | null;
  notes: string; unitPrice: number; lineTotal: number }
export interface PublicOrder { reference: string; type: OrderType; status: OrderStatus;
  roomNumber: string | null; items: OrderLine[]; subtotal: number; deliveryFee: number;
  total: number; paymentMethod: PaymentMethod; estimatedReadyAt: Timestamp | null; createdAt: Timestamp }

// ---- Admin ----
export interface User { id: number; name: string; username: string; role: Role }
export interface DecidedBy { id: number; name: string }
export interface AdminSetup extends Setup { isActive: boolean; sortOrder: number }
export interface AdminRoom { id: number; name: string; slug: string; description: string;
  totalUnits: number; isActive: boolean; sortOrder: number; amenityIds: number[];
  photos: Photo[]; setups: AdminSetup[]; createdAt: Timestamp; updatedAt: Timestamp }
export interface Upload { url: string; width: number; height: number }
export interface MenuCategory { id: number; name: string; sortOrder: number; itemCount: number }
export interface MenuItem { id: number; categoryId: number; name: string; description: string;
  price: number; dietaryTags: DietaryTag[]; isAvailable: boolean; sortOrder: number;
  sideOptions: string[]; photo: Photo | null }
export interface Order extends PublicOrder { id: number; guestName: string; phone: string;
  email: string | null; notes: string; tableBookingReference: string | null;
  updatedAt: Timestamp; decidedBy: DecidedBy | null }
export interface RoomBooking { id: number; reference: string; roomType: { id: number; name: string };
  setup: { id: number; name: string }; checkIn: IsoDate; checkOut: IsoDate; nights: number;
  guests: number; pricePerNight: number; totalPrice: number; guestName: string; email: string;
  phone: string; notes: string; status: BookingStatus; expiresAt: Timestamp | null;
  decidedAt: Timestamp | null; decidedBy: DecidedBy | null; createdAt: Timestamp }
export interface TableBooking { id: number; reference: string; date: IsoDate; timeSlot: TimeOfDay;
  partySize: number; guestName: string; email: string; phone: string; notes: string;
  status: BookingStatus; preOrderReference: string | null; decidedAt: Timestamp | null;
  decidedBy: DecidedBy | null; createdAt: Timestamp }
export interface BlockedDate { id: number; roomTypeId: number; roomTypeName: string;
  startDate: IsoDate; endDate: IsoDate; units: number; reason: string } // endDate exclusive
export interface Summary { pendingRoomRequests: number; pendingTableRequests: number;
  newOrders: number; ordersInProgress: number; arrivalsToday: number;
  departuresToday: number; tableBookingsToday: number }
