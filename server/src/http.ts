export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function readPage(query: Record<string, unknown>): { page: number; pageSize: number; skip: number } {
  const page = Math.max(1, Number(query.page) || 1);
  const requested = Number(query.pageSize) || 20;
  const pageSize = Math.min(500, Math.max(1, requested));
  return { page, pageSize, skip: (page - 1) * pageSize };
}
