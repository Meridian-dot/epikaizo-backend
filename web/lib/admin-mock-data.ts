// web/lib/admin-mock-data.ts  (admin only; the website has its own mock-data.ts)
// Pretend data in EXACTLY the shapes of Docking Spec v1.1 (sections 7 and 8).
// Everything marked DUMMY is made up and must never reach the live site.
// Room counts, setups and prices use the client's answers (dev-c/requirements.md), not v1.1's placeholders.
import type {
  AdminRoom, Amenity, BlockedDate, MenuCategory, MenuItem, Order, PageContent, Photo,
  RoomBooking, SiteSettings, TableBooking, User,
} from "@/types/api";

const now = Date.now();
const hoursFromNow = (h: number) => new Date(now + h * 3600_000).toISOString();
const created = "2026-11-24T10:18:39.790Z";
const pic = (text: string) => `https://placehold.co/1600x1067/3E160C/B9942C/png?text=${encodeURIComponent(text)}`;

// ---------- Logins (practice mode only: any of these usernames, password "password123") ----------
export const users: User[] = [
  { id: 1, name: "Tina Shingenge", username: "tina", role: "manager" },
  { id: 2, name: "Jeanite", username: "jeanite", role: "staff" },
];
export const MOCK_PASSWORD = "password123";

// ---------- Rooms ----------
export const amenities: Amenity[] = [
  { id: 1, name: "Air conditioning", icon: "snowflake" },
  { id: 2, name: "Balcony", icon: "balcony" },
  { id: 3, name: "Closet", icon: "closet" },
  { id: 4, name: "Fridge", icon: "fridge" },
  { id: 5, name: "Kettle and coffee", icon: "kettle" },
  { id: 6, name: "Private bathroom", icon: "bath" },
  { id: 7, name: "Shared bathroom and shower", icon: "shower" },
  { id: 8, name: "Shared sitting room", icon: "sofa" },
  { id: 9, name: "TV", icon: "tv" },
];

let photoId = 100;
const photo = (alt: string, sortOrder: number): Photo => ({ id: ++photoId, url: pic(alt), alt, sortOrder });

let setupId = 0;
const setup = (name: string, maxGuests: number, pricePerNight: number, sortOrder: number, onRequest = false) =>
  ({ id: ++setupId, name, maxGuests, pricePerNight, onRequest, isActive: true, sortOrder });

// Twin and Double are separate setups here (not v1.1's "Twin/Double"), so staff know whether to push
// the beds together. Setups are data the owner edits, so this needs no change to the spec.
const typeTwoSetups = () => [setup("Single", 1, 400, 1), setup("Twin", 2, 550, 2), setup("Double", 2, 550, 3)];

export const rooms: AdminRoom[] = [
  { id: 1, name: "Type I", slug: "type-i", description: "Our spacious family rooms with two 3/4 beds and space for an extra single bed.",
    totalUnits: 2, isActive: true, sortOrder: 1, amenityIds: [1, 3, 4, 5, 6, 9],
    photos: [photo("Type I room with two beds", 1), photo("Type I bathroom", 2)],
    setups: [setup("Single", 1, 440, 1), setup("Twin", 2, 550, 2), setup("Double", 2, 550, 3),
      setup("Family (twin + single)", 3, 850, 4), setup("Family (double + single)", 3, 850, 5)],
    createdAt: created, updatedAt: created },
  { id: 2, name: "Type II upstairs, with balcony", slug: "type-ii-upstairs", description: "Standard rooms with two 3/4 beds and a balcony.",
    totalUnits: 5, isActive: true, sortOrder: 2, amenityIds: [1, 2, 3, 4, 5, 6, 9],
    photos: [photo("Type II upstairs room with balcony", 1)], setups: typeTwoSetups(), createdAt: created, updatedAt: created },
  { id: 3, name: "Type II downstairs", slug: "type-ii-downstairs", description: "Standard rooms with two 3/4 beds.",
    totalUnits: 5, isActive: true, sortOrder: 3, amenityIds: [1, 3, 4, 5, 6, 9],
    photos: [], setups: typeTwoSetups(), createdAt: created, updatedAt: created },
  { id: 4, name: "Type III", slug: "type-iii", description: "Compact rooms with one 3/4 bed in the old bunker, with a shared bathroom and sitting room.",
    totalUnits: 5, isActive: true, sortOrder: 4, amenityIds: [1, 7, 8],
    photos: [], setups: [setup("Single", 1, 300, 1), setup("Couple", 2, 400, 2, true)], createdAt: created, updatedAt: created },
  // Awkward case: a hidden room, with a hidden setup.
  { id: 5, name: "DUMMY Garden cottage (hidden)", slug: "dummy-garden-cottage", description: "A test room that is hidden from the website.",
    totalUnits: 1, isActive: false, sortOrder: 5, amenityIds: [1], photos: [],
    setups: [{ ...setup("Double", 2, 900, 1), isActive: false }], createdAt: created, updatedAt: created },
];
export const nextSetupId = () => ++setupId;

// ---------- Gallery ----------
export const gallery: Photo[] = [
  photo("DUMMY Front of the guesthouse", 1),
  photo("DUMMY Restaurant tables at night", 2),
  photo("DUMMY The Ombalantu baobab tree", 3),
];

// ---------- Menu (DUMMY menu, placeholder prices) ----------
const SIDES = ["Chips", "Rice", "Veggie", "Pasta", "Spaghetti", "Pap", "Baked potatoes", "Boiled potatoes"];
export const menuCategories: MenuCategory[] = [
  { id: 1, name: "Breakfast", sortOrder: 1, itemCount: 0 },
  { id: 2, name: "Main Course: Red Meat", sortOrder: 2, itemCount: 0 },
  { id: 3, name: "Drinks", sortOrder: 3, itemCount: 0 },
];
export const menuItems: MenuItem[] = [
  { id: 1, categoryId: 1, name: "DUMMY Full breakfast", description: "Eggs, bacon, sausage, toast and coffee.", price: 120, dietaryTags: [], isAvailable: true, sortOrder: 1, sideOptions: [], photo: null },
  { id: 2, categoryId: 1, name: "DUMMY Fruit and yoghurt", description: "Seasonal fruit with plain yoghurt.", price: 75, dietaryTags: ["vegetarian", "gluten-free"], isAvailable: true, sortOrder: 2, sideOptions: [], photo: null },
  // Awkward case: an item with sides.
  { id: 41, categoryId: 2, name: "DUMMY Grilled T-bone steak", description: "Served with a choice of one side.", price: 210, dietaryTags: [], isAvailable: true, sortOrder: 1, sideOptions: SIDES, photo: photo("DUMMY T-bone steak on a plate", 1) },
  { id: 42, categoryId: 2, name: "DUMMY Oryx steak", description: "Served with a choice of one side.", price: 230, dietaryTags: [], isAvailable: true, sortOrder: 2, sideOptions: ["Chips", "Rice", "Pap"], photo: null },
  // Awkward case: not available today.
  { id: 43, categoryId: 2, name: "DUMMY Kapana platter", description: "Grilled beef strips with salsa.", price: 160, dietaryTags: ["halal", "spicy"], isAvailable: false, sortOrder: 3, sideOptions: [], photo: null },
  { id: 120, categoryId: 3, name: "DUMMY Cool drink can 300ml", description: "", price: 18, dietaryTags: ["vegan"], isAvailable: true, sortOrder: 1, sideOptions: [], photo: null },
  { id: 121, categoryId: 3, name: "DUMMY Coffee", description: "Filter coffee.", price: 30, dietaryTags: ["vegan"], isAvailable: true, sortOrder: 2, sideOptions: [], photo: null },
];

// ---------- Website text (DUMMY copy) ----------
const page = (key: PageContent["key"], title: string, subtitle: string, headings: string[]): PageContent => ({
  key, title, subtitle, updatedAt: created,
  sections: headings.map((heading) => ({ heading, body: `DUMMY First paragraph about ${heading.toLowerCase()}.\n\nDUMMY Second paragraph.` })),
});
export const content: PageContent[] = [
  page("home", "Stay Somewhere with a Story to Tell.", "DUMMY Discover the warmth of Namibian hospitality.", ["More than just a place to stay", "A landmark at our doorstep"]),
  page("about", "About us", "DUMMY A place where history lives on.", ["Our story"]),
  page("rooms", "Accommodation", "DUMMY Rooms for every kind of trip.", ["Our rooms"]),
  page("restaurant", "Restaurant", "DUMMY Good food every day, 07:00 to 22:00.", ["Our kitchen"]),
  page("events", "Meetings and events", "DUMMY A hall for about 60 people.", ["The hall"]),
  page("contact", "Contact us", "DUMMY We'd love to hear from you.", ["Find us"]),
];

// ---------- Room bookings ----------
const longNote =
  "We are a family of three travelling from Windhoek for a wedding. We will probably arrive very late, around 23:30, " +
  "because we leave after work. Could you please leave the outside light on and the key at reception? Our daughter is 9 " +
  "and would like the single bed. We also need a quiet room if possible, and we would love breakfast at 07:00 on both days. " +
  "Thank you very much!";

export const roomBookings: RoomBooking[] = [
  // Awkward cases: pending and expires soon, with a long note.
  { id: 12, reference: "EPK-R-7K3Q9", roomType: { id: 1, name: "Type I" }, setup: { id: 4, name: "Family (twin + single)" },
    checkIn: "2026-12-20", checkOut: "2026-12-23", nights: 3, guests: 3, pricePerNight: 850, totalPrice: 2550,
    guestName: "Maria Shikongo", email: "maria@example.com", phone: "+264 81 123 4567", notes: longNote, status: "pending",
    expiresAt: hoursFromNow(3), decidedAt: null, decidedBy: null, createdAt: hoursFromNow(-45) },
  { id: 13, reference: "EPK-R-2M7PL", roomType: { id: 2, name: "Type II upstairs, with balcony" }, setup: { id: 8, name: "Double" },
    checkIn: "2026-12-18", checkOut: "2026-12-19", nights: 1, guests: 2, pricePerNight: 550, totalPrice: 550,
    guestName: "Johannes Amutenya", email: "johannes@example.com", phone: "+264 81 222 3333", notes: "", status: "pending",
    expiresAt: hoursFromNow(40), decidedAt: null, decidedBy: null, createdAt: hoursFromNow(-8) },
  // Awkward case: on request (Type III Couple).
  { id: 14, reference: "EPK-R-6CPL3", roomType: { id: 4, name: "Type III" }, setup: { id: 13, name: "Couple" },
    checkIn: "2026-12-26", checkOut: "2026-12-27", nights: 1, guests: 2, pricePerNight: 400, totalPrice: 400,
    guestName: "Tomas Nekongo", email: "tomas@example.com", phone: "+264 81 555 1234", notes: "We don't mind one bed.", status: "pending",
    expiresAt: hoursFromNow(30), decidedAt: null, decidedBy: null, createdAt: hoursFromNow(-18) },
  // Awkward case: expired.
  { id: 11, reference: "EPK-R-9XW2B", roomType: { id: 4, name: "Type III" }, setup: { id: 12, name: "Single" },
    checkIn: "2026-12-15", checkOut: "2026-12-17", nights: 2, guests: 1, pricePerNight: 300, totalPrice: 600,
    guestName: "Peter Nghipondoka", email: "peter@example.com", phone: "+264 81 444 5555", notes: "Work trip", status: "expired",
    expiresAt: hoursFromNow(-20), decidedAt: null, decidedBy: null, createdAt: hoursFromNow(-68) },
  // Awkward case: crosses New Year.
  { id: 10, reference: "EPK-R-4NY27", roomType: { id: 3, name: "Type II downstairs" }, setup: { id: 10, name: "Twin" },
    checkIn: "2026-12-30", checkOut: "2027-01-02", nights: 3, guests: 2, pricePerNight: 550, totalPrice: 1650,
    guestName: "Selma Haufiku", email: "selma@example.com", phone: "+264 81 666 7777", notes: "New Year's Eve dinner too, please", status: "confirmed",
    expiresAt: null, decidedAt: hoursFromNow(-30), decidedBy: { id: 1, name: "Tina Shingenge" }, createdAt: hoursFromNow(-50) },
  { id: 9, reference: "EPK-R-8DCL1", roomType: { id: 1, name: "Type I" }, setup: { id: 3, name: "Double" },
    checkIn: "2026-12-05", checkOut: "2026-12-06", nights: 1, guests: 2, pricePerNight: 550, totalPrice: 550,
    guestName: "David Iipinge", email: "david@example.com", phone: "+264 81 888 9999", notes: "", status: "declined",
    expiresAt: null, decidedAt: hoursFromNow(-100), decidedBy: { id: 2, name: "Jeanite" }, createdAt: hoursFromNow(-110) },
  { id: 8, reference: "EPK-R-3CAN5", roomType: { id: 3, name: "Type II downstairs" }, setup: { id: 9, name: "Single" },
    checkIn: "2026-12-10", checkOut: "2026-12-12", nights: 2, guests: 1, pricePerNight: 400, totalPrice: 800,
    guestName: "Anna Nangolo", email: "anna@example.com", phone: "+264 81 000 1111", notes: "", status: "cancelled",
    expiresAt: null, decidedAt: hoursFromNow(-90), decidedBy: { id: 1, name: "Tina Shingenge" }, createdAt: hoursFromNow(-150) },
];

// ---------- Table bookings ----------
export const tableBookings: TableBooking[] = [
  { id: 5, reference: "EPK-T-4M8XZ", date: "2026-12-20", timeSlot: "19:00", partySize: 4, guestName: "Maria Shikongo",
    email: "maria@example.com", phone: "+264 81 123 4567", notes: "Birthday", status: "pending", preOrderReference: "EPK-O-2H6WQ",
    decidedAt: null, decidedBy: null, createdAt: hoursFromNow(-5) },
  { id: 6, reference: "EPK-T-7QP2D", date: "2026-12-20", timeSlot: "13:00", partySize: 10, guestName: "DUMMY Office lunch",
    email: "team@example.com", phone: "+264 81 321 6540", notes: "Cake at the end", status: "confirmed", preOrderReference: null,
    decidedAt: hoursFromNow(-2), decidedBy: { id: 2, name: "Jeanite" }, createdAt: hoursFromNow(-20) },
  { id: 7, reference: "EPK-T-1ZZ8K", date: "2026-12-21", timeSlot: "09:00", partySize: 2, guestName: "Johannes Amutenya",
    email: "johannes@example.com", phone: "+264 81 222 3333", notes: "", status: "pending", preOrderReference: null,
    decidedAt: null, decidedBy: null, createdAt: hoursFromNow(-1) },
];

// ---------- Food orders ----------
export const orders: Order[] = [
  { id: 31, reference: "EPK-O-9P3LD", type: "room_service", status: "received", roomNumber: "12",
    items: [ { menuItemId: 41, name: "DUMMY Grilled T-bone steak", quantity: 1, side: "Pap", notes: "", unitPrice: 210, lineTotal: 210 },
             { menuItemId: 120, name: "DUMMY Cool drink can 300ml", quantity: 2, side: null, notes: "", unitPrice: 18, lineTotal: 36 } ],
    subtotal: 246, deliveryFee: 20, total: 266, paymentMethod: "cash", estimatedReadyAt: hoursFromNow(0.6), createdAt: hoursFromNow(-0.1),
    guestName: "Selma Haufiku", phone: "+264 81 666 7777", email: "selma@example.com", notes: "No onions please",
    tableBookingReference: null, updatedAt: hoursFromNow(-0.1), decidedBy: null },
  { id: 32, reference: "EPK-O-4KC88", type: "collection", status: "accepted", roomNumber: null,
    items: [ { menuItemId: 42, name: "DUMMY Oryx steak", quantity: 1, side: "Rice", notes: "Well done", unitPrice: 230, lineTotal: 230 } ],
    subtotal: 230, deliveryFee: 0, total: 230, paymentMethod: "card", estimatedReadyAt: hoursFromNow(0.4), createdAt: hoursFromNow(-0.3),
    guestName: "DUMMY Walk-in customer", phone: "+264 81 999 0000", email: null, notes: "",
    tableBookingReference: null, updatedAt: hoursFromNow(-0.2), decidedBy: { id: 2, name: "Jeanite" } },
  { id: 33, reference: "EPK-O-2H6WQ", type: "table", status: "received", roomNumber: null,
    items: [ { menuItemId: 41, name: "DUMMY Grilled T-bone steak", quantity: 2, side: "Chips", notes: "", unitPrice: 210, lineTotal: 420 },
             { menuItemId: 2, name: "DUMMY Fruit and yoghurt", quantity: 1, side: null, notes: "", unitPrice: 75, lineTotal: 75 },
             { menuItemId: 121, name: "DUMMY Coffee", quantity: 1, side: null, notes: "", unitPrice: 30, lineTotal: 30 } ],
    subtotal: 525, deliveryFee: 0, total: 525, paymentMethod: "card", estimatedReadyAt: null, createdAt: hoursFromNow(-5),
    guestName: "Maria Shikongo", phone: "+264 81 123 4567", email: "maria@example.com", notes: "",
    tableBookingReference: "EPK-T-4M8XZ", updatedAt: hoursFromNow(-5), decidedBy: null },
];

// ---------- Blocked dates ----------
export const blockedDates: BlockedDate[] = [
  { id: 2, roomTypeId: 3, roomTypeName: "Type II downstairs", startDate: "2027-01-12", endDate: "2027-01-14", units: 2, reason: "Painting" },
];

// ---------- Settings ----------
// Contact details and check-in time are the client's answers (requirements.md), not v1.1's "+264 ..." placeholders.
// Ordering hours are v1.1's; the compatibility PDF says 07:00-22:00 and 09:00-22:00. Ask Dev B.
export const settings: SiteSettings = {
  contact: { phone: "+264 81 8230 233", whatsapp: "+264 81 8230 233", email: "epikaizoguesthouse@gmail.com", address: "Erf 1140, Outapi, 90000" },
  links: { instagram: "https://www.instagram.com/epikaizoguest/", googleMaps: "https://maps.app.goo.gl/6U1rnV8P3Scc36j1A" },
  checkInTime: "12:00", checkOutTime: "10:00",
  restaurant: { openingTime: "07:00", closingTime: "22:00", slotMinutes: 30, diningMinutes: 300, maxCoversPerSlot: 70, preOrderNoticeMinutes: 180 },
  ordering: { roomService: { from: "19:00", to: "22:00", deliveryFee: 20 }, collection: { from: "21:00", to: "22:00" },
    prepMinutes: 45, paymentMethods: ["cash", "card"] },
};
