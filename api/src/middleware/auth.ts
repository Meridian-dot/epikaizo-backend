// Admin login sessions.
// Logging in sets an httpOnly cookie holding a random token. The database keeps
// only the token's SHA-256 hash (admin_sessions), so the cookie can't be read by
// page scripts and a copy of the database can't be used to log in.
import { createHash, randomBytes } from "node:crypto";
import type { CookieOptions, RequestHandler, Response } from "express";
import { and, eq, gt, lt } from "drizzle-orm";
import { db } from "../db/index.js";
import { adminSessions, adminUsers } from "../db/schema.js";
import { env } from "../env.js";
import { HttpError } from "./errors.js";

export const SESSION_COOKIE = "epk_session";
const SESSION_DAYS = 7;

export type SessionUser = { id: number; name: string; username: string; role: "manager" | "staff" };

// Lets route handlers read req.user after requireStaff.
declare global {
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production", // https only on the real site
    path: "/",
  };
}

export const toUser = (u: { id: number; name: string; username: string; role: "manager" | "staff" }): SessionUser => ({
  id: u.id,
  name: u.name,
  username: u.username,
  role: u.role,
});

export async function startSession(res: Response, userId: number) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  // Tidy up old sessions while we're here.
  await db.delete(adminSessions).where(lt(adminSessions.expiresAt, new Date()));
  await db.insert(adminSessions).values({ tokenHash: hashToken(token), userId, expiresAt });
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions(), expires: expiresAt });
}

export async function endSession(token: string | undefined, res: Response) {
  if (token) await db.delete(adminSessions).where(eq(adminSessions.tokenHash, hashToken(token)));
  res.clearCookie(SESSION_COOKIE, cookieOptions());
}

// Finds the logged-in user from the cookie, or null.
export async function userFromToken(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  const [row] = await db
    .select({ id: adminUsers.id, name: adminUsers.name, username: adminUsers.username, role: adminUsers.role })
    .from(adminSessions)
    .innerJoin(adminUsers, eq(adminSessions.userId, adminUsers.id))
    .where(and(eq(adminSessions.tokenHash, hashToken(token)), gt(adminSessions.expiresAt, new Date())));
  return row ?? null;
}

// Any logged-in staff member (manager or staff).
export const requireStaff: RequestHandler = async (req, _res, next) => {
  const user = await userFromToken(req.cookies?.[SESSION_COOKIE]);
  if (!user) throw new HttpError(401, "not_logged_in", "Please log in.");
  req.user = user;
  next();
};

// Use after requireStaff.
export const requireManager: RequestHandler = (req, _res, next) => {
  if (req.user?.role !== "manager") throw new HttpError(403, "forbidden", "Only a manager can do this.");
  next();
};
