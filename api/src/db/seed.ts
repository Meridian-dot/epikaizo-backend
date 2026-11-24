// Fills the database with FAKE starter data so the frontend has something to show.
// Run with: npm run db:seed
// WARNING: it empties the rooms, menu, content and bookings tables first.
// Never run it against production. Replace the fake data with the client's
// real content when Dev C has it (target: Sat 28 Nov).
import { sql } from "drizzle-orm";
import { db, pool } from "./index.js";
import {
  amenities,
  menuCategories,
  menuItems,
  pageContent,
  photos,
  restaurantSettings,
  roomTypeAmenities,
  roomTypes,
} from "./schema.js";
import { env } from "../env.js";

if (env.NODE_ENV === "production") {
  console.error("Refusing to seed a production database.");
  process.exit(1);
}

const placeholder = (text: string) => `https://placehold.co/1600x1067?text=${encodeURIComponent(text)}`;

async function seed() {
  await db.transaction(async (tx) => {
    // Empty the tables (bookings too, since they point at rooms).
    await tx.execute(sql`
      truncate table room_bookings, table_bookings, blocked_dates, photos,
        room_type_amenities, amenities, room_types, menu_items, menu_categories,
        page_content, restaurant_settings
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
          pricePerNight: 850,
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
      { categoryId: mains.id, name: "Grilled kapana platter", description: "Placeholder.", price: 165, sortOrder: 1 },
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

    // --- Page text (fake) ---
    await tx.insert(pageContent).values([
      { key: "home", title: "Welcome to Epikaizo Guesthouse", body: "Placeholder welcome text." },
      { key: "about", title: "About us", body: "Placeholder story of the guesthouse." },
      { key: "contact", title: "Contact us", body: "Placeholder address, phone and reception hours." },
    ]);
  });

  console.log("Seed complete: 3 room types, 6 amenities, 3 menu categories, 7 menu items, 3 pages.");
}

seed()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
