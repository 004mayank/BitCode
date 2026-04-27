export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

/** Returns a stable guest UUID from localStorage (created once per browser). */
function guestId(): string {
  if (typeof window === "undefined") return "";
  try {
    const key = "bc-guest-id";
    let id = localStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(key, id);
    }
    return id;
  } catch { return ""; }
}

async function getAuthHeader(): Promise<Record<string, string>> {
  // Try NextAuth token first
  try {
    const r = await fetch("/api/api-token", { cache: "no-store" });
    if (r.ok) {
      const j = await r.json().catch(() => null);
      const token = (j as any)?.token;
      if (token) return { Authorization: `Bearer ${token}` };
    }
  } catch {}
  // Fall back to guest session header
  const id = guestId();
  return id ? { "X-Guest-Id": id } : {};
}

export async function apiGet<T>(path: string): Promise<T> {
  const auth = await getAuthHeader();
  const r = await fetch(`${API_BASE}${path}`, { cache: "no-store", headers: auth });
  if (!r.ok) throw new Error(`GET ${path} failed: ${r.status}`);
  return (await r.json()) as T;
}

export async function apiPost<T>(path: string, body: any): Promise<T> {
  const auth = await getAuthHeader();
  const r = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...auth },
    body: JSON.stringify(body)
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as any)?.error ? JSON.stringify((j as any).error) : `POST ${path} failed: ${r.status}`);
  return j as T;
}
