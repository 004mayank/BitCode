import crypto from "node:crypto";
import { db } from "@bitcode/db/src/index.js";

// Minimal JWT verify for NextAuth (HS256) tokens.
// NOTE: This is intentionally small for MVP; swap to a library later if needed.

function b64urlToBuf(s: string) {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(b64, "base64");
}

function timingSafeEqual(a: Buffer, b: Buffer) {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function verifyHs256Jwt(token: string, secret: string): any {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("invalid token");
  const [h, p, sig] = parts;
  const data = `${h}.${p}`;
  const expected = crypto.createHmac("sha256", secret).update(data).digest();
  const got = b64urlToBuf(sig);
  if (!timingSafeEqual(expected, got)) throw new Error("bad signature");
  const payload = JSON.parse(b64urlToBuf(p).toString("utf8"));
  if (payload?.exp && Date.now() / 1000 > Number(payload.exp)) throw new Error("token expired");
  return payload;
}

export type AuthedUser = {
  id: string;
  github?: string | null;
  email?: string | null;
  name?: string | null;
};

/** Try authenticated user first; fall back to a guest row keyed by X-Guest-Id header. */
export async function getUser(req: any): Promise<AuthedUser> {
  // Try real auth first
  const auth = String(req.header("authorization") || "");
  if (auth.match(/^Bearer\s+.+$/i)) {
    return requireUser(req);
  }

  // Guest mode: X-Guest-Id header carries a client-generated UUID
  const guestId = String(req.header("x-guest-id") || "").trim().slice(0, 64);
  if (!guestId) throw new Error("missing bearer token");

  const id = `guest-${guestId}`;
  const user = await db.user.upsert({
    where:  { id },
    update: {},
    create: { id, name: "Guest" }
  });
  return { id: user.id, github: null, email: null, name: "Guest" };
}

export async function requireUser(req: any): Promise<AuthedUser> {
  const auth = String(req.header("authorization") || "");
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) throw new Error("missing bearer token");
  const token = m[1];
  const secret = String(process.env.NEXTAUTH_SECRET || "");
  if (!secret) throw new Error("NEXTAUTH_SECRET not configured");

  const payload = verifyHs256Jwt(token, secret);
  const userId = String(payload?.sub || "").trim();
  if (!userId) throw new Error("missing sub");

  // NextAuth token commonly includes these fields when we set them.
  const github = payload?.github || payload?.login || payload?.username || null;
  const email = payload?.email || null;
  const name = payload?.name || null;

  // Ensure user exists (id comes from NextAuth/Prisma).
  const user = await db.user.upsert({
    where: { id: userId },
    update: {
      email: email ?? undefined,
      name: name ?? undefined,
      github: github ?? undefined
    },
    create: {
      id: userId,
      email: email ?? undefined,
      name: name ?? undefined,
      github: github ?? undefined
    }
  });

  return { id: user.id, github: user.github, email: user.email, name: user.name };
}

export function requireAdmin(user: AuthedUser) {
  const adminGh = String(process.env.ADMIN_GITHUB || "").trim().toLowerCase();
  if (!adminGh) return; // if unset, no admin restriction
  const gh = String(user.github || "").trim().toLowerCase();
  if (gh !== adminGh) {
    throw new Error("admin required");
  }
}
