// Reads and checks environment variables once, at startup.
// If something required is missing, the API refuses to start and says what is wrong,
// instead of failing later with a confusing error.
import "dotenv/config";
import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url(),
  // Comma-separated list of sites allowed to call the API, e.g. the Next.js app.
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  // Folder for uploaded photos (relative to api/). Not committed.
  UPLOAD_DIR: z.string().default("uploads"),
  // The API address browsers use, for photo links. Default: http://localhost:PORT
  PUBLIC_API_URL: z.union([z.literal(""), z.string().url()]).optional(),
  // Cloudinary account for photo storage, from the Cloudinary dashboard:
  // cloudinary://<api_key>:<api_secret>@<cloud_name>
  // Required on Render (its disk is wiped on every restart). Leave empty locally
  // to keep photos in UPLOAD_DIR instead.
  CLOUDINARY_URL: z.union([z.literal(""), z.string().startsWith("cloudinary://")]).optional(),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:");
  console.error(z.prettifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;
export const corsOrigins = env.CORS_ORIGIN.split(",").map((o) => o.trim());
