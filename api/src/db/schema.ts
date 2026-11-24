// The database tables, written in TypeScript.
// Change this file, then run `npm run db:generate` to create a migration
// and `npm run db:migrate` to apply it.
import { relations } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  time,
  timestamp,
} from "drizzle-orm/pg-core";

// ---------- Shared value lists ----------

export const bookingStatus = pgEnum("booking_status", [
  "pending",
  "confirmed",
  "declined",
  "cancelled",
  "expired",
]);

export const adminRole = pgEnum("admin_role", ["manager", "staff"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

// ---------- Admin users ----------

export const adminUsers = pgTable("admin_users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: adminRole("role").notNull().default("staff"),
  ...timestamps,
});

// ---------- Rooms ----------

export const roomTypes = pgTable("room_types", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(), // used in URLs: /rooms/family-suite
  description: text("description").notNull().default(""),
  // Price per night in Namibian dollars.
  pricePerNight: numeric("price_per_night", { precision: 10, scale: 2, mode: "number" }).notNull(),
  maxGuests: integer("max_guests").notNull(),
  // How many physical rooms of this type the guesthouse has.
  totalUnits: integer("total_units").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  ...timestamps,
});

export const amenities = pgTable("amenities", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  icon: text("icon"), // icon name for the frontend, e.g. "wifi"
});

// Which amenities each room type has (many-to-many).
export const roomTypeAmenities = pgTable(
  "room_type_amenities",
  {
    roomTypeId: integer("room_type_id")
      .notNull()
      .references(() => roomTypes.id, { onDelete: "cascade" }),
    amenityId: integer("amenity_id")
      .notNull()
      .references(() => amenities.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.roomTypeId, t.amenityId] })],
);

// ---------- Restaurant menu ----------

export const menuCategories = pgTable("menu_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const menuItems = pgTable("menu_items", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id")
    .notNull()
    .references(() => menuCategories.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  price: numeric("price", { precision: 10, scale: 2, mode: "number" }).notNull(),
  dietaryTags: text("dietary_tags").array().notNull().default([]), // e.g. ["vegetarian"]
  isAvailable: boolean("is_available").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  ...timestamps,
});

// ---------- Photos (rooms, menu items, or the general gallery) ----------

export const photos = pgTable("photos", {
  id: serial("id").primaryKey(),
  url: text("url").notNull(),
  alt: text("alt").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  roomTypeId: integer("room_type_id").references(() => roomTypes.id, { onDelete: "cascade" }),
  menuItemId: integer("menu_item_id").references(() => menuItems.id, { onDelete: "cascade" }),
  isGallery: boolean("is_gallery").notNull().default(false),
  createdAt: timestamps.createdAt,
});

// ---------- Room bookings ----------
// A stay occupies the nights from checkIn up to, but NOT including, checkOut.
// So a guest leaving on the 5th and another arriving on the 5th do not clash.

export const roomBookings = pgTable(
  "room_bookings",
  {
    id: serial("id").primaryKey(),
    reference: text("reference").notNull().unique(), // shown to the guest, e.g. EPK-R-7K3Q9
    roomTypeId: integer("room_type_id")
      .notNull()
      .references(() => roomTypes.id),
    checkIn: date("check_in").notNull(),
    checkOut: date("check_out").notNull(),
    guests: integer("guests").notNull(),
    guestName: text("guest_name").notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    notes: text("notes").notNull().default(""),
    status: bookingStatus("status").notNull().default("pending"),
    // When a pending request stops holding the room (e.g. 48 hours after it was made).
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    decidedBy: integer("decided_by").references(() => adminUsers.id),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("room_bookings_lookup_idx").on(t.roomTypeId, t.checkIn, t.checkOut)],
);

// Rooms taken out of use (maintenance, walk-ins). Same rule as stays:
// startDate included, endDate not included.
export const blockedDates = pgTable("blocked_dates", {
  id: serial("id").primaryKey(),
  roomTypeId: integer("room_type_id")
    .notNull()
    .references(() => roomTypes.id, { onDelete: "cascade" }),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  units: integer("units").notNull().default(1),
  reason: text("reason").notNull().default(""),
  createdAt: timestamps.createdAt,
});

// ---------- Restaurant bookings ----------

// One row only: the restaurant's booking rules.
export const restaurantSettings = pgTable("restaurant_settings", {
  id: integer("id").primaryKey().default(1),
  openingTime: time("opening_time").notNull(), // "11:00"
  closingTime: time("closing_time").notNull(), // "22:00"
  slotMinutes: integer("slot_minutes").notNull().default(30),
  maxCoversPerSlot: integer("max_covers_per_slot").notNull(), // seats per time slot
  updatedAt: timestamps.updatedAt,
});

export const tableBookings = pgTable(
  "table_bookings",
  {
    id: serial("id").primaryKey(),
    reference: text("reference").notNull().unique(),
    date: date("date").notNull(),
    timeSlot: time("time_slot").notNull(),
    partySize: integer("party_size").notNull(),
    guestName: text("guest_name").notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    notes: text("notes").notNull().default(""),
    status: bookingStatus("status").notNull().default("pending"),
    decidedBy: integer("decided_by").references(() => adminUsers.id),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("table_bookings_slot_idx").on(t.date, t.timeSlot)],
);

// ---------- Editable page text (home, about, contact) ----------

export const pageContent = pgTable("page_content", {
  key: text("key").primaryKey(), // "home" | "about" | "contact"
  title: text("title").notNull(),
  body: text("body").notNull(),
  updatedAt: timestamps.updatedAt,
});

// ---------- Relations (let us load a room with its amenities and photos in one query) ----------

export const roomTypesRelations = relations(roomTypes, ({ many }) => ({
  amenities: many(roomTypeAmenities),
  photos: many(photos),
  bookings: many(roomBookings),
}));

export const amenitiesRelations = relations(amenities, ({ many }) => ({
  roomTypes: many(roomTypeAmenities),
}));

export const roomTypeAmenitiesRelations = relations(roomTypeAmenities, ({ one }) => ({
  roomType: one(roomTypes, { fields: [roomTypeAmenities.roomTypeId], references: [roomTypes.id] }),
  amenity: one(amenities, { fields: [roomTypeAmenities.amenityId], references: [amenities.id] }),
}));

export const photosRelations = relations(photos, ({ one }) => ({
  roomType: one(roomTypes, { fields: [photos.roomTypeId], references: [roomTypes.id] }),
  menuItem: one(menuItems, { fields: [photos.menuItemId], references: [menuItems.id] }),
}));

export const menuCategoriesRelations = relations(menuCategories, ({ many }) => ({
  items: many(menuItems),
}));

export const menuItemsRelations = relations(menuItems, ({ one, many }) => ({
  category: one(menuCategories, { fields: [menuItems.categoryId], references: [menuCategories.id] }),
  photos: many(photos),
}));

export const roomBookingsRelations = relations(roomBookings, ({ one }) => ({
  roomType: one(roomTypes, { fields: [roomBookings.roomTypeId], references: [roomTypes.id] }),
}));
