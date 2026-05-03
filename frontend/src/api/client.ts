const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export function getToken(): string {
  return sessionStorage.getItem("pt_token") ?? "";
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${getToken()}`, ...init?.headers },
  });
  if (res.status === 401) {
    sessionStorage.removeItem("pt_token");
    window.location.reload();
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Request failed");
  }
  return res.json() as Promise<T>;
}
