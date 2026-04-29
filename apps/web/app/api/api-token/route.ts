import { auth } from "../../../auth";
import crypto from "node:crypto";

// MVP bridge: mint an HS256 JWT compatible with the API verifier.
// This avoids dealing with cross-domain cookies between :3000 and :8000.

function b64url(input: Buffer | string) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function signHs256(payload: any, secret: string) {
  const header = { alg: "HS256", typ: "JWT" };
  const h = b64url(JSON.stringify(header));
  const p = b64url(JSON.stringify(payload));
  const data = `${h}.${p}`;
  const sig = crypto.createHmac("sha256", secret).update(data).digest();
  return `${data}.${b64url(sig)}`;
}

export async function GET() {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) return Response.json({ error: "NEXTAUTH_SECRET not set" }, { status: 500 });

  const userId = (session.user as any).id;
  if (!userId) return Response.json({ error: "missing user id" }, { status: 500 });

  const exp = Math.floor(Date.now() / 1000) + 60 * 10; // 10 min
  const token = signHs256(
    {
      sub: userId,
      github: (session.user as any).login || (session.user as any).github || null,
      email: session.user.email || null,
      name: session.user.name || null,
      exp
    },
    secret
  );

  return Response.json({ token, exp });
}
