// Photo uploads.
//   POST /admin/uploads   multipart form, field "file" -> { url, width, height }
//   GET  /uploads/<name>  serves files saved on this computer (local mode only)
// The dashboard then attaches the returned url to a room, dish or the gallery
// with POST /admin/photos.
//
// Where photos are stored:
//   - CLOUDINARY_URL set (staging, production): Cloudinary. The returned url is a
//     permanent https://res.cloudinary.com/... link. Required on Render, because
//     Render's free plan wipes its disk on every deploy, restart and idle spin-down.
//   - CLOUDINARY_URL empty (local development): files in UPLOAD_DIR (api/uploads/),
//     served by this API at /uploads/<name>.
import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";
import express, { type RequestHandler } from "express";
import { imageSize } from "image-size";
import multer from "multer";
import { env } from "../env.js";
import { HttpError } from "../middleware/errors.js";

export const UPLOAD_DIR = path.resolve(env.UPLOAD_DIR);
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const TYPES: Record<string, string> = { jpg: ".jpg", png: ".png", webp: ".webp" };

// Cloudinary folder for this site's photos, and the largest size we keep.
const CLOUD_FOLDER = "epikaizo";
const MAX_SIDE = 1600;

const useCloudinary = Boolean(env.CLOUDINARY_URL);
if (useCloudinary) {
  // The SDK reads CLOUDINARY_URL from the environment; secure = always https links.
  cloudinary.config({ secure: true });
} else {
  mkdirSync(UPLOAD_DIR, { recursive: true });
  if (env.NODE_ENV === "production") {
    console.warn("CLOUDINARY_URL is not set: uploaded photos are saved on this server's disk and will be lost when it restarts.");
  }
}

// Full address of the API as browsers see it, e.g. http://localhost:4000 (local mode only).
const publicBase = () => (env.PUBLIC_API_URL || `http://localhost:${env.PORT}`).replace(/\/$/, "");

const receive = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES, files: 1 } }).single("file");

// Sends the file to Cloudinary, shrinking anything larger than MAX_SIDE on its longest side.
function uploadToCloudinary(buffer: Buffer): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: CLOUD_FOLDER,
        resource_type: "image",
        transformation: [{ width: MAX_SIDE, height: MAX_SIDE, crop: "limit", quality: "auto" }],
      },
      (error, result) => (error || !result ? reject(error ?? new Error("No result from Cloudinary")) : resolve(result)),
    );
    stream.end(buffer);
  });
}

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

    if (useCloudinary) {
      let result: UploadApiResponse;
      try {
        result = await uploadToCloudinary(req.file.buffer);
      } catch (error) {
        console.error("Cloudinary upload failed:", error);
        throw new HttpError(502, "upload_failed", "The photo could not be saved. Please try again in a minute.");
      }
      res.status(201).json({ url: result.secure_url, width: result.width, height: result.height });
      return;
    }

    const name = `${Date.now()}-${randomBytes(6).toString("hex")}${ext}`;
    await writeFile(path.join(UPLOAD_DIR, name), req.file.buffer);
    res.status(201).json({ url: `${publicBase()}/uploads/${name}`, width: info.width, height: info.height });
  },
];

// Cloudinary's id for a photo, from its link:
// https://res.cloudinary.com/<cloud>/image/upload/v1732540000/epikaizo/abc123.jpg -> "epikaizo/abc123"
export function cloudinaryPublicId(url: string): string | null {
  const match = url.match(/^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/(?:[^/]*\/)*?(?:v\d+\/)?(epikaizo\/[^.]+)\.[a-z0-9]+$/i);
  return match ? match[1] : null;
}

// Removes the stored file behind a photo URL, if it is one of ours. Ignores anything else,
// and never fails the request: a leftover file is harmless, a failed delete is not worth an error.
export async function deleteUploadedFile(url: string) {
  const publicId = cloudinaryPublicId(url);
  if (publicId) {
    if (useCloudinary) await cloudinary.uploader.destroy(publicId).catch((e) => console.error("Cloudinary delete failed:", e));
    return;
  }
  const prefix = `${publicBase()}/uploads/`;
  if (!url.startsWith(prefix)) return;
  const name = path.basename(url.slice(prefix.length));
  await unlink(path.join(UPLOAD_DIR, name)).catch(() => {});
}

// Static files for local mode. Other sites (the public website, the dashboard) may show them.
export const serveUploads = [
  (_req: express.Request, res: express.Response, next: express.NextFunction) => {
    res.set("Cross-Origin-Resource-Policy", "cross-origin");
    next();
  },
  express.static(UPLOAD_DIR, { maxAge: "7d", index: false, fallthrough: true }),
];
