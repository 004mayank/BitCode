export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

export async function apiGet<T>(path: string): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`GET ${path} failed: ${r.status}`);
  return (await r.json()) as T;
}

export async function apiPost<T>(path: string, body: any): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as any)?.error ? JSON.stringify((j as any).error) : `POST ${path} failed: ${r.status}`);
  return j as T;
}

