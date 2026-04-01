import { Router } from "express";
import { v4 as uuidv4 } from "uuid";

declare module "express-session" {
  interface SessionData {
    userId?: string;
    email?: string;
    isGuest?: boolean;
  }
}

export const authRouter = Router();

authRouter.get("/me", (req, res) => {
  if (req.session.userId) {
    res.json({
      id: req.session.userId,
      email: req.session.email || null,
      isGuest: req.session.isGuest ?? true,
    });
  } else {
    res.json(null);
  }
});

authRouter.post("/guest", (req, res) => {
  if (!req.session.userId) {
    req.session.userId = uuidv4();
    req.session.isGuest = true;
  }
  res.json({
    id: req.session.userId,
    email: null,
    isGuest: true,
  });
});

authRouter.post("/signup", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }
  const { db } = await import("../db.js");
  const { users } = await import("../../shared/userSchema.js");
  const { eq } = await import("drizzle-orm");
  const bcrypt = await import("bcryptjs");

  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) {
    return res.status(400).json({ error: "Email already registered" });
  }
  const passwordHash = await bcrypt.default.hash(password, 10);
  const [user] = await db.insert(users).values({ email, passwordHash }).returning();

  req.session.userId = user.id;
  req.session.email = user.email;
  req.session.isGuest = false;
  res.json({ id: user.id, email: user.email, isGuest: false });
});

authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }
  const { db } = await import("../db.js");
  const { users } = await import("../../shared/userSchema.js");
  const { eq } = await import("drizzle-orm");
  const bcrypt = await import("bcryptjs");

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) {
    return res.status(401).json({ error: "Invalid email or password" });
  }
  const valid = await bcrypt.default.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid email or password" });
  }
  req.session.userId = user.id;
  req.session.email = user.email;
  req.session.isGuest = false;
  res.json({ id: user.id, email: user.email, isGuest: false });
});

authRouter.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});
