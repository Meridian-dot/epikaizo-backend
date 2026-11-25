// Admin login.
//   POST /auth/login   { "username", "password" } -> { "user": { id, name, username, role } } + session cookie
//   POST /auth/logout  -> 204, clears the cookie
//   GET  /auth/me      -> { "user": ... } or 401
// The same three are also served at /admin/login, /admin/logout and /admin/me.
import bcrypt from "bcryptjs";
import { Router } from "express";
import { eq, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { adminUsers } from "../db/schema.js";
import { HttpError } from "../middleware/errors.js";
import { endSession, requireStaff, SESSION_COOKIE, startSession, toUser } from "../middleware/auth.js";

export const authRouter = Router();

// "username" is what the dashboard sends. "email" is accepted too (docs/api.md v1).
const LoginBody = z
  .object({
    username: z.string().trim().min(1).max(200).optional(),
    email: z.string().trim().min(1).max(200).optional(),
    password: z.string().min(1).max(200),
  })
  .refine((b) => b.username || b.email, { message: "Enter your username", path: ["username"] });

// Used when the username doesn't exist, so a wrong username takes as long as a wrong password.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

authRouter.post("/login", async (req, res) => {
  const body = LoginBody.parse(req.body);
  const name = (body.username ?? body.email ?? "").toLowerCase();
  const user = await db.query.adminUsers.findFirst({
    where: or(eq(adminUsers.username, name), eq(adminUsers.email, name)),
  });
  const ok = await bcrypt.compare(body.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) throw new HttpError(401, "invalid_credentials", "Wrong username or password.");
  await startSession(res, user.id);
  res.json({ user: toUser(user) });
});

authRouter.post("/logout", async (req, res) => {
  await endSession(req.cookies?.[SESSION_COOKIE], res);
  res.status(204).end();
});

authRouter.get("/me", requireStaff, (req, res) => {
  res.json({ user: req.user });
});
