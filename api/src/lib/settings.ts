// Website settings (the dashboard's Settings page), stored as one JSON row in site_settings.
import { z } from "zod";

const Time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM, e.g. 19:00");
const Money = z.number().min(0).max(100000);

export const SiteSettingsSchema = z.object({
  contact: z.object({
    phone: z.string().max(50),
    whatsapp: z.string().max(50),
    email: z.string().max(200),
    address: z.string().max(500),
  }),
  links: z.object({ instagram: z.string().max(500), googleMaps: z.string().max(500) }),
  checkInTime: Time,
  checkOutTime: Time,
  restaurant: z.object({
    openingTime: Time,
    closingTime: Time,
    slotMinutes: z.union([z.literal(15), z.literal(30), z.literal(60)]),
    diningMinutes: z.number().int().min(15).max(1440),
    maxCoversPerSlot: z.number().int().min(1).max(1000),
    preOrderNoticeMinutes: z.number().int().min(0).max(10080),
  }),
  ordering: z.object({
    roomService: z.object({ from: Time, to: Time, deliveryFee: Money }),
    collection: z.object({ from: Time, to: Time }),
    prepMinutes: z.number().int().min(0).max(1440),
    paymentMethods: z.array(z.enum(["cash", "card"])).min(1),
  }),
});

export type SiteSettings = z.infer<typeof SiteSettingsSchema>;

// Used by the seed, and returned if the row is missing. PLACEHOLDER values.
export const DEFAULT_SETTINGS: SiteSettings = {
  contact: {
    phone: "+264 81 000 0000",
    whatsapp: "+264 81 000 0000",
    email: "info@example.com",
    address: "Placeholder address, Outapi",
  },
  links: { instagram: "", googleMaps: "" },
  checkInTime: "12:00",
  checkOutTime: "10:00",
  restaurant: {
    openingTime: "11:00",
    closingTime: "22:00",
    slotMinutes: 30,
    diningMinutes: 120,
    maxCoversPerSlot: 20,
    preOrderNoticeMinutes: 180,
  },
  ordering: {
    roomService: { from: "19:00", to: "22:00", deliveryFee: 20 },
    collection: { from: "11:00", to: "22:00" },
    prepMinutes: 45,
    paymentMethods: ["cash", "card"],
  },
};
