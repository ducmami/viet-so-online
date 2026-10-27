import type { Doc, Page } from "./types";

export class ApiError extends Error {}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const body: { message?: string } = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(body.message || "Có một lỗi không mong muốn đã xảy ra!");
  }
  return body as T;
}

export function listDict(type: string, q = ""): Promise<Page<Doc>> {
  const params = new URLSearchParams({ type, pageSize: "500", page: "1" });
  if (q) params.set("q", q);
  return api<Page<Doc>>(`/api/dict?${params.toString()}`);
}
