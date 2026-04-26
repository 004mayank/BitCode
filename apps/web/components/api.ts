export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

async function getAuthHeader(): Promise<Record<string, string>> {
  // MVP: use NextAuth session endpoint.
  // NOTE: NextAuth does not return a bearer token by default.
  // We instead mint a short-lived API token via our own endpoint.
  try {
    const r = await fetch("/api/api-token", { cache: "no-store" });
    if (!r.ok) return {};
    const j = await r.json().catch(() => null);
    const token = (j as any)?.token;
    if (token) return { Authorization: `Bearer ${token}` };
  } catch {}
  return {};
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
