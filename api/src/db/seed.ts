// Fills the database with FAKE starter data so the frontend has something to show.
// Run with: npm run db:seed
// WARNING: it empties the rooms, menu, content and bookings tables first.
// Never run it against production. Replace the fake data with the client's
// real content when Dev C has it (target: Sat 28 Nov).
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import { db, pool } from "./index.js";
import {
  adminUsers,
  amenities,
  menuCategories,
  menuItems,
  pageContent,
  photos,
  restaurantSettings,
  roomTypeAmenities,
  roomSetups,
  roomTypes,
  siteSettings,
} from "./schema.js";
import { env } from "../env.js";
import { sectionsToBody, type PageSection } from "../lib/content.js";
import { DEFAULT_SETTINGS } from "../lib/settings.js";

if (env.NODE_ENV === "production") {
  console.error("Refusing to seed a production database.");
  process.exit(1);
}

// DEV-ONLY login for the dashboard. NOT a real secret: change it (or set
// ADMIN_SEED_PASSWORD in .env) before anyone outside the team can reach the API.
const DEV_ADMIN_USERNAME = "admin";
const DEV_ADMIN_PASSWORD = process.env.ADMIN_SEED_PASSWORD || "epikaizo-dev-only";

const placeholder = (text: string) => `https://placehold.co/1600x1067?text=${encodeURIComponent(text)}`;

async function seed() {
  await db.transaction(async (tx) => {
    // Empty the tables (bookings too, since they point at rooms).
    await tx.execute(sql`
      truncate table room_bookings, table_bookings, blocked_dates, photos,
        room_type_amenities, amenities, room_types, menu_items, menu_categories,
        page_content, restaurant_settings, room_setups, site_settings
      restart identity cascade
    `);

    // --- Amenities ---
    const [wifi, aircon, tv, ensuite, kettle, parking] = await tx
      .insert(amenities)
      .values([
        { name: "Free Wi-Fi", icon: "wifi" },
        { name: "Air conditioning", icon: "snowflake" },
        { name: "Smart TV", icon: "tv" },
        { name: "En-suite bathroom", icon: "bath" },
        { name: "Tea and coffee station", icon: "coffee" },
        { name: "Secure parking", icon: "car" },
      ])
      .returning();

    // --- Room types (fake until the client's details arrive) ---
    const [standard, twin, family] = await tx
      .insert(roomTypes)
      .values([
        {
          name: "Standard Double",
          slug: "standard-double",
          description: "A quiet double room with a queen-size bed. Placeholder text.",
          pricePerNight: 750, // = cheapest setup below
          maxGuests: 2,
          totalUnits: 4,
          sortOrder: 1,
        },
        {
          name: "Twin Room",
          slug: "twin-room",
          description: "Two single beds, ideal for colleagues or friends. Placeholder text.",
          pricePerNight: 950,
          maxGuests: 2,
          totalUnits: 3,
          sortOrder: 2,
        },
        {
          name: "Family Suite",
          slug: "family-suite",
          description: "A queen bed and two singles with a small lounge. Placeholder text.",
          pricePerNight: 1450,
          maxGuests: 4,
          totalUnits: 2,
          sortOrder: 3,
        },
      ])
      .returning();

    // Setups and prices per room type (fake). room_types.price_per_night above
    // matches the cheapest active setup, and max_guests the largest.
    await tx.insert(roomSetups).values([
      { roomTypeId: standard.id, name: "Single", maxGuests: 1, pricePerNight: 750, sortOrder: 1 },
      { roomTypeId: standard.id, name: "Double", maxGuests: 2, pricePerNight: 850, sortOrder: 2 },
      { roomTypeId: twin.id, name: "Twin", maxGuests: 2, pricePerNight: 950, sortOrder: 1 },
      { roomTypeId: family.id, name: "Family (queen + two singles)", maxGuests: 4, pricePerNight: 1450, sortOrder: 1 },
      { roomTypeId: family.id, name: "Group booking", maxGuests: 4, pricePerNight: 1450, onRequest: true, sortOrder: 2 },
    ]);

    await tx.insert(roomTypeAmenities).values([
      ...[wifi, aircon, tv, ensuite, kettle, parking].map((a) => ({ roomTypeId: standard.id, amenityId: a.id })),
      ...[wifi, aircon, ensuite, kettle, parking].map((a) => ({ roomTypeId: twin.id, amenityId: a.id })),
      ...[wifi, aircon, tv, ensuite, kettle, parking].map((a) => ({ roomTypeId: family.id, amenityId: a.id })),
    ]);

    await tx.insert(photos).values([
      { roomTypeId: standard.id, url: placeholder("Standard Double"), alt: "Standard Double room", sortOrder: 1 },
      { roomTypeId: standard.id, url: placeholder("Standard Double bathroom"), alt: "Standard Double bathroom", sortOrder: 2 },
      { roomTypeId: twin.id, url: placeholder("Twin Room"), alt: "Twin Room", sortOrder: 1 },
      { roomTypeId: family.id, url: placeholder("Family Suite"), alt: "Family Suite", sortOrder: 1 },
      { roomTypeId: family.id, url: placeholder("Family Suite lounge"), alt: "Family Suite lounge", sortOrder: 2 },
      { isGallery: true, url: placeholder("Guesthouse exterior"), alt: "Outside of the guesthouse", sortOrder: 1 },
      { isGallery: true, url: placeholder("Garden"), alt: "Garden", sortOrder: 2 },
    ]);

    // --- Menu (fake) ---
    const [breakfast, mains, drinks] = await tx
      .insert(menuCategories)
      .values([
        { name: "Breakfast", sortOrder: 1 },
        { name: "Mains", sortOrder: 2 },
        { name: "Drinks", sortOrder: 3 },
      ])
      .returning();

    await tx.insert(menuItems).values([
      { categoryId: breakfast.id, name: "Full breakfast", description: "Eggs, bacon, sausage, toast. Placeholder.", price: 145, sortOrder: 1 },
      { categoryId: breakfast.id, name: "Yoghurt and granola", description: "Placeholder.", price: 85, dietaryTags: ["vegetarian"], sortOrder: 2 },
      { categoryId: mains.id, name: "Grilled kapana platter", description: "Placeholder.", price: 165, sideOptions: ["Chips", "Pap"], sortOrder: 1 },
      { categoryId: mains.id, name: "Vegetable curry", description: "Placeholder.", price: 135, dietaryTags: ["vegetarian", "vegan"], sortOrder: 2 },
      { categoryId: mains.id, name: "Oryx steak", description: "Placeholder.", price: 245, isAvailable: false, sortOrder: 3 },
      { categoryId: drinks.id, name: "Fresh juice", description: "Placeholder.", price: 45, sortOrder: 1 },
      { categoryId: drinks.id, name: "Filter coffee", description: "Placeholder.", price: 30, sortOrder: 2 },
    ]);

    // --- Restaurant booking rules (fake until Dev C confirms with the client) ---
    await tx.insert(restaurantSettings).values({
      id: 1,
      openingTime: "11:00",
      closingTime: "22:00",
      slotMinutes: 30,
      maxCoversPerSlot: 20,
    });

    // --- Page text (fake). body = the section texts joined, for GET /content/:key. ---
    const page = (key: string, title: string, subtitle: string, sections: PageSection[]) => ({
      key,
      title,
      subtitle,
      sections,
      body: sectionsToBody(sections),
    });
    await tx.insert(pageContent).values([
      page("home", "Welcome to Epikaizo Guesthouse", "Placeholder subtitle.", [{ heading: "", body: "Placeholder welcome text." }]),
      page("about", "About us", "Placeholder subtitle.", [{ heading: "Our story", body: "Placeholder story of the guesthouse." }]),
      page("rooms", "Accommodation", "Placeholder subtitle.", [{ heading: "Our rooms", body: "Placeholder rooms intro." }]),
      page("restaurant", "Restaurant", "Placeholder subtitle.", [{ heading: "Our kitchen", body: "Placeholder restaurant intro." }]),
      page("events", "Meetings and events", "Placeholder subtitle.", [{ heading: "The hall", body: "Placeholder events intro." }]),
      page("contact", "Contact us", "Placeholder subtitle.", [{ heading: "Find us", body: "Placeholder address, phone and reception hours." }]),
    ]);

    // --- Website settings (dashboard Settings page). Placeholder values. ---
    // Restaurant times match restaurant_settings above.
    await tx.insert(siteSettings).values({ id: 1, data: DEFAULT_SETTINGS });

    // --- Dev admin login (kept if it exists, password reset to the dev one) ---
    const passwordHash = await bcrypt.hash(DEV_ADMIN_PASSWORD, 10);
    await tx
      .insert(adminUsers)
      .values({ name: "Dev Admin", username: DEV_ADMIN_USERNAME, passwordHash, role: "manager" })
      .onConflictDoUpdate({ target: adminUsers.username, set: { passwordHash, role: "manager" } });
  });

  console.log("Seed complete: 3 room types, 5 setups, 6 amenities, 3 menu categories, 7 menu items, 6 pages, settings.");
  console.log(`Dev admin login: ${DEV_ADMIN_USERNAME} / ${DEV_ADMIN_PASSWORD} (dev only)`);
}

seed()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
