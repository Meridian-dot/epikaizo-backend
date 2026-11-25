// Photo uploads, stored as files on this computer (api/uploads/, not committed).
//   POST /admin/uploads   multipart form, field "file" -> { url, width, height }
//   GET  /uploads/<name>  serves the file
// The dashboard then attaches the returned url to a room, dish or the gallery
// with POST /admin/photos.
//
// Good enough for local work and a single server. On a host that wipes its disk
// on every deploy (e.g. Render free tier), switch to cloud storage later.
import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import express, { type RequestHandler } from "express";
import { imageSize } from "image-size";
import multer from "multer";
import { env } from "../env.js";
import { HttpError } from "../middleware/errors.js";

export const UPLOAD_DIR = path.resolve(env.UPLOAD_DIR);
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const TYPES: Record<string, string> = { jpg: ".jpg", png: ".png", webp: ".webp" };

mkdirSync(UPLOAD_DIR, { recursive: true });

// Full address of the API as browsers see it, e.g. http://localhost:4000
const publicBase = () => (env.PUBLIC_API_URL || `http://localhost:${env.PORT}`).replace(/\/$/, "");

const receive = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES, files: 1 } }).single("file");

export const uploadPhoto: RequestHandler[] = [
  (req, res, next) =>
    receive(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE")
        return next(new HttpError(400, "invalid_input", "This photo is bigger than 5 MB. Please choose a smaller one.", { file: ["Bigger than 5 MB."] }));
      if (err) return next(new HttpError(400, "invalid_input", "The photo could not be read. Please try again."));
      next();
    }),
  async (req, res) => {
    if (!req.file) throw new HttpError(400, "invalid_input", "Choose a photo first.", { file: ["Choose a photo."] });
    // Check the file's real content, not just its name.
    let info: ReturnType<typeof imageSize>;
    try {
      info = imageSize(req.file.buffer);
    } catch {
      info = { width: 0, height: 0 };
    }
    const ext = info.type ? TYPES[info.type] : undefined;
    if (!ext || !info.width || !info.height)
      throw new HttpError(400, "invalid_input", "Please choose a JPEG, PNG or WebP photo.", { file: ["Not a JPEG, PNG or WebP photo."] });
    const name = `${Date.now()}-${randomBytes(6).toString("hex")}${ext}`;
    await writeFile(path.join(UPLOAD_DIR, name), req.file.buffer);
    res.status(201).json({ url: `${publicBase()}/uploads/${name}`, width: info.width, height: info.height });
  },
];

// Removes the file behind a photo URL, if it is one of ours. Ignores anything else.
export async function deleteUploadedFile(url: string) {
  const prefix = `${publicBase()}/uploads/`;
  if (!url.startsWith(prefix)) return;
  const name = path.basename(url.slice(prefix.length));
  await unlink(path.join(UPLOAD_DIR, name)).catch(() => {});
}

// Static files. Other sites (the public website, the dashboard) may show them.
export const serveUploads = [
  (_req: express.Request, res: express.Response, next: express.NextFunction) => {
    res.set("Cross-Origin-Resource-Policy", "cross-origin");
    next();
  },
  express.static(UPLOAD_DIR, { maxAge: "7d", index: false, fallthrough: true }),
];
